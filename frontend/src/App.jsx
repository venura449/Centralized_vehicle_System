import { useCallback, useEffect, useMemo, useState } from 'react';
import api from './services/api';
import './App.css';

const AUTH_DEFAULT = { name: '', email: '', password: '' };
const VEHICLE_DEFAULT = { name: '', vehicleIdentifier: '', description: '' };

const telemetrySummaryFields = [
  { key: 'speed', label: 'Speed (km/h)', suffix: ' km/h' },
  { key: 'rpm', label: 'RPM', suffix: '' },
  { key: 'coolant_temp', label: 'Coolant (°C)', suffix: ' °C' },
  { key: 'engine_load', label: 'Engine Load (%)', suffix: '%' },
  { key: 'throttle', label: 'Throttle (%)', suffix: '%' },
  { key: 'afr', label: 'AFR', suffix: '' }
];

const comparisonMetrics = [
  { key: 'speed', label: 'Speed (km/h)', suffix: ' km/h' },
  { key: 'rpm', label: 'RPM', suffix: '' },
  { key: 'coolant_temp', label: 'Coolant (°C)', suffix: ' °C' },
  { key: 'engine_load', label: 'Engine Load (%)', suffix: '%' },
  { key: 'throttle', label: 'Throttle (%)', suffix: '%' },
  { key: 'afr', label: 'AFR', suffix: '' },
  { key: 'lambda', label: 'Lambda', suffix: '' }
];

const metricThresholds = {
  speed: { low: 5, high: 120 },
  rpm: { low: 800, high: 3800 },
  coolant_temp: { low: 75, high: 105 },
  engine_load: { low: 15, high: 90 },
  throttle: { low: 5, high: 95 },
  afr: { low: 13.5, high: 15.5 },
  lambda: { low: 0.92, high: 1.08 }
};

const vehicleDetailFields = [
  { label: 'Vehicle name', accessor: (vehicle) => vehicle?.name || '—' },
  {
    label: 'Identifier',
    accessor: (vehicle) => vehicle?.vehicleIdentifier || '—'
  },
  {
    label: 'Description',
    accessor: (vehicle) => vehicle?.description || 'Not provided'
  },
  {
    label: 'Created',
    accessor: (vehicle) =>
      vehicle ? new Date(vehicle.createdAt).toLocaleString() : '—'
  }
];

const formatMetricValue = (value, suffix = '') => {
  if (value === undefined || value === null || Number.isNaN(value)) {
    return '—';
  }
  return `${value}${suffix}`;
};

const getMetricClassName = (key, value) => {
  if (value === undefined || value === null || Number.isNaN(value)) {
    return '';
  }
  const thresholds = metricThresholds[key];
  if (!thresholds) return '';
  if (thresholds.high !== undefined && value > thresholds.high) {
    return 'metric-critical';
  }
  if (thresholds.low !== undefined && value < thresholds.low) {
    return 'metric-low';
  }
  return 'metric-safe';
};

function App() {
  const [authMode, setAuthMode] = useState('login');
  const [authForm, setAuthForm] = useState(AUTH_DEFAULT);
  const [vehicleForm, setVehicleForm] = useState(VEHICLE_DEFAULT);
  const [user, setUser] = useState(() => {
    const stored = window.localStorage.getItem('user');
    return stored ? JSON.parse(stored) : null;
  });
  const [vehicles, setVehicles] = useState([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState(null);
  const [telemetry, setTelemetry] = useState([]);
  const [status, setStatus] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(false);
  const [loadingVehicles, setLoadingVehicles] = useState(false);
  const [loadingTelemetry, setLoadingTelemetry] = useState(false);
  const [vehicleFilters, setVehicleFilters] = useState({
    search: '',
    dataOnly: false,
    sort: 'recent'
  });

  const selectedVehicle = useMemo(
    () => vehicles.find((v) => v.id === selectedVehicleId) || null,
    [vehicles, selectedVehicleId]
  );

  const latestTelemetry = useMemo(() => {
    if (telemetry.length) return telemetry[0];
    if (selectedVehicle?.latestData) return selectedVehicle.latestData;
    return null;
  }, [telemetry, selectedVehicle]);

  const filteredVehicles = useMemo(() => {
    const term = vehicleFilters.search.toLowerCase();
    let list = [...vehicles];
    if (vehicleFilters.dataOnly) {
      list = list.filter((vehicle) => Boolean(vehicle.latestData));
    }
    if (term) {
      list = list.filter(
        (vehicle) =>
          vehicle.name.toLowerCase().includes(term) ||
          vehicle.vehicleIdentifier.toLowerCase().includes(term)
      );
    }
    if (vehicleFilters.sort === 'name') {
      list.sort((a, b) => a.name.localeCompare(b.name));
    } else if (vehicleFilters.sort === 'identifier') {
      list.sort((a, b) =>
        a.vehicleIdentifier.localeCompare(b.vehicleIdentifier)
      );
    } else {
      list.sort(
        (a, b) =>
          new Date(b.createdAt).valueOf() - new Date(a.createdAt).valueOf()
      );
    }
    return list;
  }, [vehicles, vehicleFilters]);

  const fleetInsights = useMemo(() => {
    if (!vehicles.length) {
      return null;
    }
    let fastest = null;
    let hottest = null;
    let freshest = null;
    vehicles.forEach((vehicle) => {
      const data = vehicle.latestData;
      if (!data) return;
      if (!fastest || (data.speed ?? 0) > (fastest.speed ?? 0)) {
        fastest = { name: vehicle.name, speed: data.speed };
      }
      if (!hottest || (data.coolant_temp ?? 0) > (hottest.coolant_temp ?? 0)) {
        hottest = { name: vehicle.name, coolant_temp: data.coolant_temp };
      }
      if (
        !freshest ||
        (data.timestamp_ms ?? 0) > (freshest.timestamp_ms ?? 0)
      ) {
        freshest = { name: vehicle.name, timestamp_ms: data.timestamp_ms };
      }
    });

    return {
      total: vehicles.length,
      active: vehicles.filter((v) => Boolean(v.latestData)).length,
      fastest,
      hottest,
      freshest
    };
  }, [vehicles]);

  const showStatus = (type, message) => {
    setStatus({ type, message });
    setTimeout(() => setStatus(null), 5000);
  };

  const handleApiError = (error) => {
    const message =
      error?.response?.data?.message ||
      error?.message ||
      'Unexpected error occurred';
    showStatus('error', message);
  };

  const fetchVehicles = useCallback(async () => {
    if (!user) return;
    setLoadingVehicles(true);
    try {
      const { data } = await api.get('/api/vehicles');
      setVehicles(data);
      if (!selectedVehicleId && data.length) {
        setSelectedVehicleId(data[0].id);
      } else if (
        selectedVehicleId &&
        !data.find((vehicle) => vehicle.id === selectedVehicleId)
      ) {
        setSelectedVehicleId(data[0]?.id ?? null);
      }
    } catch (error) {
      handleApiError(error);
    } finally {
      setLoadingVehicles(false);
    }
  }, [user, selectedVehicleId]);

  const fetchTelemetry = useCallback(async () => {
    if (!selectedVehicleId || !user) return;
    setLoadingTelemetry(true);
    try {
      const { data } = await api.get(
        `/api/vehicles/${selectedVehicleId}/data`,
        {
          params: { limit: 25 }
        }
      );
      setTelemetry(data);
    } catch (error) {
      handleApiError(error);
    } finally {
      setLoadingTelemetry(false);
    }
  }, [selectedVehicleId, user]);

  useEffect(() => {
    if (user) {
      fetchVehicles();
    } else {
      setVehicles([]);
      setTelemetry([]);
      setSelectedVehicleId(null);
    }
  }, [user, fetchVehicles]);

  useEffect(() => {
    if (!user) return;
    const intervalId = setInterval(fetchVehicles, 15000);
    return () => clearInterval(intervalId);
  }, [user, fetchVehicles]);

  useEffect(() => {
    if (!selectedVehicleId || !user) return;
    setTelemetry([]);
    fetchTelemetry();
    const id = setInterval(fetchTelemetry, 5000);
    return () => clearInterval(id);
  }, [selectedVehicleId, user, fetchTelemetry]);

  const handleAuthChange = (e) => {
    const { name, value } = e.target;
    setAuthForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleVehicleChange = (e) => {
    const { name, value } = e.target;
    setVehicleForm((prev) => ({ ...prev, [name]: value }));
  };

  const persistSession = (token, userProfile) => {
    window.localStorage.setItem('token', token);
    window.localStorage.setItem('user', JSON.stringify(userProfile));
    setUser(userProfile);
  };

  const clearSession = () => {
    window.localStorage.removeItem('token');
    window.localStorage.removeItem('user');
    setUser(null);
  };

  const handleFilterChange = (changes) => {
    setVehicleFilters((prev) => ({ ...prev, ...changes }));
  };

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setLoadingAuth(true);
    try {
      const endpoint = authMode === 'login' ? 'login' : 'register';
      const { data } = await api.post(`/api/auth/${endpoint}`, authForm);
      persistSession(data.token, data.user);
      setAuthForm(AUTH_DEFAULT);
      showStatus('success', `Welcome ${data.user.name}!`);
    } catch (error) {
      handleApiError(error);
    } finally {
      setLoadingAuth(false);
    }
  };

  const handleVehicleSubmit = async (e) => {
    e.preventDefault();
    try {
      const { data } = await api.post('/api/vehicles', vehicleForm);
      showStatus(
        'success',
        `Vehicle ${data.name} registered with identifier ${data.vehicleIdentifier}`
      );
      setVehicleForm(VEHICLE_DEFAULT);
      fetchVehicles();
    } catch (error) {
      handleApiError(error);
    }
  };

  const handleLogout = () => {
    clearSession();
    showStatus('success', 'Signed out');
  };

  const isAuthDisabled =
    loadingAuth ||
    (authMode === 'register' && !authForm.name.trim()) ||
    !authForm.email.trim() ||
    authForm.password.length < 8;

  const isVehicleDisabled =
    !vehicleForm.name.trim() || !vehicleForm.vehicleIdentifier.trim();

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <h1>Centralized Vehicle System</h1>
          <p>Track vehicles in real time via MQTT and MySQL</p>
        </div>
        {user && (
          <div className="user-chip">
            <div>
              <strong>{user.name}</strong>
              <span>{user.email}</span>
            </div>
            <button className="ghost-btn" onClick={handleLogout}>
              Logout
            </button>
          </div>
        )}
      </header>

      {status && (
        <div className={`status-banner ${status.type}`}>{status.message}</div>
      )}

      <main>
        {!user && (
          <section className="panel auth-panel">
            <div className="auth-toggle">
              <button
                className={authMode === 'login' ? 'active' : ''}
                onClick={() => setAuthMode('login')}
              >
                Login
              </button>
              <button
                className={authMode === 'register' ? 'active' : ''}
                onClick={() => setAuthMode('register')}
              >
                Register
              </button>
            </div>

            <form className="form" onSubmit={handleAuthSubmit}>
              {authMode === 'register' && (
                <label>
                  <span>Name</span>
                  <input
                    name="name"
                    value={authForm.name}
                    onChange={handleAuthChange}
                    placeholder="Jane Driver"
                  />
                </label>
              )}

              <label>
                <span>Email</span>
                <input
                  type="email"
                  name="email"
                  value={authForm.email}
                  onChange={handleAuthChange}
                  placeholder="you@example.com"
                />
              </label>

              <label>
                <span>Password</span>
                <input
                  type="password"
                  name="password"
                  value={authForm.password}
                  onChange={handleAuthChange}
                  placeholder="Minimum 8 characters"
                />
              </label>

              <button
                type="submit"
                className="primary-btn"
                disabled={isAuthDisabled}
              >
                {loadingAuth
                  ? 'Please wait...'
                  : authMode === 'login'
                    ? 'Sign in'
                    : 'Create account'}
              </button>
            </form>
          </section>
        )}

        {user && (
          <section className="dashboard">
            <div className="dashboard-top">
              <div className="panel vehicles-panel">
                <div className="panel-header">
                  <h2>Your vehicles</h2>
                  <button onClick={fetchVehicles} className="ghost-btn">
                    Refresh
                  </button>
                </div>

                <div className="filter-bar">
                  <input
                    type="search"
                    placeholder="Search by name or identifier"
                    value={vehicleFilters.search}
                    onChange={(e) =>
                      handleFilterChange({ search: e.target.value })
                    }
                  />
                  <div className="filter-controls">
                    <label className="checkbox">
                      <input
                        type="checkbox"
                        checked={vehicleFilters.dataOnly}
                        onChange={(e) =>
                          handleFilterChange({ dataOnly: e.target.checked })
                        }
                      />
                      <span>Has live data</span>
                    </label>
                    <select
                      value={vehicleFilters.sort}
                      onChange={(e) =>
                        handleFilterChange({ sort: e.target.value })
                      }
                    >
                      <option value="recent">Newest</option>
                      <option value="name">Name A-Z</option>
                      <option value="identifier">Identifier A-Z</option>
                    </select>
                  </div>
                </div>

                {loadingVehicles ? (
                  <p>Loading vehicles...</p>
                ) : filteredVehicles.length ? (
                  <ul className="vehicle-list">
                    {filteredVehicles.map((vehicle) => (
                      <li
                        key={vehicle.id}
                        className={
                          vehicle.id === selectedVehicleId ? 'active' : ''
                        }
                        onClick={() => setSelectedVehicleId(vehicle.id)}
                      >
                        <strong>{vehicle.name}</strong>
                        <span>ID: {vehicle.vehicleIdentifier}</span>
                        {vehicle.latestData && (
                          <small>
                            Last frame:{' '}
                            {new Date(
                              vehicle.latestData.timestamp_ms
                            ).toLocaleString()}
                          </small>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>No vehicles yet. Add one below.</p>
                )}

                <form className="form" onSubmit={handleVehicleSubmit}>
                  <h3>Add a vehicle</h3>
                  <label>
                    <span>Name</span>
                    <input
                      name="name"
                      value={vehicleForm.name}
                      onChange={handleVehicleChange}
                      placeholder="Fleet Van 3"
                      required
                    />
                  </label>

                  <label>
                    <span>Vehicle Identifier</span>
                    <input
                      name="vehicleIdentifier"
                      value={vehicleForm.vehicleIdentifier}
                      onChange={handleVehicleChange}
                      placeholder="match payload vehicle_id"
                      required
                    />
                  </label>

                  <label>
                    <span>Description (optional)</span>
                    <textarea
                      name="description"
                      value={vehicleForm.description}
                      onChange={handleVehicleChange}
                      placeholder="Notes, VIN, etc."
                    />
                  </label>

                  <button
                    type="submit"
                    className="primary-btn"
                    disabled={isVehicleDisabled}
                  >
                    Register vehicle
                  </button>
                </form>
              </div>

              <div className="panel telemetry-panel">
                <div className="panel-header">
                  <h2>Live telemetry</h2>
                  {selectedVehicle && (
                    <span className="subtle">
                      Vehicle {selectedVehicle.vehicleIdentifier}
                    </span>
                  )}
                </div>

                {!selectedVehicle ? (
                  <p>Select a vehicle to see data.</p>
                ) : (
                  <>
                    {latestTelemetry ? (
                      <div className="telemetry-summary">
                        {telemetrySummaryFields.map((field) => (
                          <div className="summary-card" key={field.key}>
                            <span>{field.label}</span>
                            <strong
                              className={getMetricClassName(
                                field.key,
                                latestTelemetry[field.key]
                              )}
                            >
                              {formatMetricValue(
                                latestTelemetry[field.key],
                                field.suffix
                              )}
                            </strong>
                          </div>
                        ))}
      </div>
                    ) : (
                      <p>No data received yet for this vehicle.</p>
                    )}

                    <div className="history-header">
                      <h3>Recent MQTT frames</h3>
                      <button
                        className="ghost-btn"
                        onClick={fetchTelemetry}
                        disabled={loadingTelemetry}
                      >
                        Pull latest
        </button>
                    </div>

                    {loadingTelemetry ? (
                      <p>Fetching telemetry...</p>
                    ) : telemetry.length ? (
                      <div className="table-wrapper">
                        <table>
                          <thead>
                            <tr>
                              <th>Timestamp</th>
                              <th>Speed</th>
                              <th>RPM</th>
                              <th>Coolant (°C)</th>
                              <th>Throttle (%)</th>
                              <th>Lambda</th>
                            </tr>
                          </thead>
                          <tbody>
                            {telemetry.map((row) => (
                              <tr key={row.id}>
                                <td>
                                  {new Date(row.timestamp_ms).toLocaleString()}
                                </td>
                                <td>{row.speed ?? '—'}</td>
                                <td>{row.rpm ?? '—'}</td>
                                <td>{row.coolant_temp ?? '—'}</td>
                                <td>{row.throttle ?? '—'}</td>
                                <td>{row.lambda ?? '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p>No MQTT frames stored yet.</p>
                    )}
                  </>
                )}
              </div>
            </div>

            <div className="panel detail-panel">
              <div className="panel-header">
                <h2>Vehicle spotlight</h2>
                {selectedVehicle && latestTelemetry && (
                  <span className="subtle">
                    Latest frame:{' '}
                    {new Date(latestTelemetry.timestamp_ms).toLocaleString()}
                  </span>
                )}
              </div>
              {!selectedVehicle ? (
                <p>Select a vehicle to view its full profile.</p>
              ) : (
                <>
                  <div className="detail-grid">
                    {vehicleDetailFields.map((field) => (
                      <div className="detail-card" key={field.label}>
                        <span>{field.label}</span>
                        <strong>{field.accessor(selectedVehicle)}</strong>
                      </div>
                    ))}
                  </div>

                  <div className="detail-metrics">
                    {comparisonMetrics.map((metric) => (
                      <div className="detail-metric" key={metric.key}>
                        <span>{metric.label}</span>
                        <strong
                          className={getMetricClassName(
                            metric.key,
                            latestTelemetry?.[metric.key]
                          )}
                        >
                          {formatMetricValue(
                            latestTelemetry?.[metric.key],
                            metric.suffix
                          )}
                        </strong>
                      </div>
                    ))}
      </div>
                </>
              )}
            </div>

            <div className="panel comparison-panel">
              <div className="panel-header">
                <h2>Fleet comparison</h2>
                <span className="subtle">
                  Latest MQTT snapshot for each vehicle
                </span>
              </div>
              {vehicles.length ? (
                <div className="table-wrapper dense">
                  <table className="comparison-table">
                    <thead>
                      <tr>
                        <th>Vehicle</th>
                        {comparisonMetrics.map((metric) => (
                          <th key={metric.key}>{metric.label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {vehicles.map((vehicle) => (
                        <tr key={vehicle.id}>
                          <td>
                            <div className="vehicle-cell">
                              <strong>{vehicle.name}</strong>
                              <small>{vehicle.vehicleIdentifier}</small>
                            </div>
                          </td>
                          {comparisonMetrics.map((metric) => {
                            const value =
                              vehicle.latestData?.[metric.key] ??
                              vehicle.latestData?.[
                                metric.key === 'lambda' ? 'lambda_value' : metric.key
                              ];
                            return (
                              <td
                                key={metric.key}
                                className={getMetricClassName(
                                  metric.key,
                                  value
                                )}
                              >
                                {formatMetricValue(value, metric.suffix)}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p>Add vehicles to start comparisons.</p>
              )}
            </div>

            {fleetInsights && (
              <div className="panel insights-panel">
                <div className="panel-header">
                  <h2>Fleet insights</h2>
                  <span className="subtle">
                    {fleetInsights.active} of {fleetInsights.total} vehicles
                    reporting
                  </span>
                </div>
                <div className="insights-grid">
                  <div className="insight-card">
                    <span>Fastest vehicle</span>
                    <strong>
                      {fleetInsights.fastest
                        ? `${fleetInsights.fastest.name} · ${fleetInsights.fastest.speed} km/h`
                        : 'Awaiting data'}
                    </strong>
                  </div>
                  <div className="insight-card">
                    <span>Hottest coolant</span>
                    <strong>
                      {fleetInsights.hottest
                        ? `${fleetInsights.hottest.name} · ${fleetInsights.hottest.coolant_temp} °C`
                        : 'Awaiting data'}
                    </strong>
                  </div>
                  <div className="insight-card">
                    <span>Latest heartbeat</span>
                    <strong>
                      {fleetInsights.freshest
                        ? `${fleetInsights.freshest.name} · ${new Date(fleetInsights.freshest.timestamp_ms).toLocaleTimeString()}`
                        : 'Awaiting data'}
                    </strong>
                  </div>
                </div>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}

export default App;
