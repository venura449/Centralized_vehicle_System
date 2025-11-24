const mqtt = require('mqtt');
const { getPool } = require('../db');
const config = require('../config');

const TELEMETRY_FIELDS = [
  'rpm',
  'speed',
  'coolant_temp',
  'timing_advance',
  'intake_temp',
  'maf',
  'throttle',
  'engine_load',
  'manifold_pressure',
  'o2_voltage',
  'lambda',
  'o2_voltage_b1s2',
  'lambda_b1s2',
  'wideband_lambda',
  'wideband_voltage',
  'afr',
  'short_fuel_trim',
  'long_fuel_trim'
];

function startMqttListener() {
  if (!config.mqtt.enabled) {
    console.log('[MQTT] Listener disabled via config flag');
    return;
  }

  const brokerUrl = config.mqtt.brokerUrl;
  const topic = config.mqtt.topic;

  if (!brokerUrl || !topic) {
    console.warn(
      '[MQTT] Missing MQTT_BROKER_URL or MQTT_TOPIC. Skipping MQTT bootstrap.'
    );
    return;
  }

  const clientId = config.mqtt.clientId || `vehicle-api-${Date.now().toString(16)}`;

  const client = mqtt.connect(brokerUrl, {
    clientId,
    clean: true,
    reconnectPeriod: 5_000
  });

  const db = getPool();

  client.on('connect', () => {
    console.log(`[MQTT] Connected as ${clientId}, subscribing to ${topic}`);
    client.subscribe(topic, (err) => {
      if (err) {
        console.error('[MQTT] Failed to subscribe', err);
      }
    });
  });

  client.on('reconnect', () => console.log('[MQTT] Reconnecting...'));
  client.on('error', (err) => console.error('[MQTT] Error', err.message));
  client.on('offline', () => console.warn('[MQTT] Client offline'));

  client.on('message', async (_topic, payloadBuffer) => {
    try {
      const payload = JSON.parse(payloadBuffer.toString());
      const frameId = payload.id;
      const vehicleIdentifier =
        payload.id || payload.vehicleId || payload.vehicleIdentifier;

      if (!vehicleIdentifier) {
        console.warn(
          '[MQTT] Dropped frame missing vehicle identifier. Include vehicle_id in payload.'
        );
        return;
      }

      const timestampMs = payload.timestamp || Date.now();
      const [vehicles] = await db.query(
        'SELECT id FROM vehicles WHERE vehicle_identifier = ? LIMIT 1',
        [vehicleIdentifier]
      );

      if (!vehicles.length) {
        console.warn(
          `[MQTT] Received frame for unknown vehicle identifier ${vehicleIdentifier}`
        );
        return;
      }

      const telemetryPayload = {
        vehicle_id: vehicles[0].id,
        frame_id: frameId,
        timestamp_ms: timestampMs
      };

      TELEMETRY_FIELDS.forEach((field) => {
        if (payload[field] !== undefined) {
          if (field === 'lambda') {
            telemetryPayload.lambda_value = payload[field];
          } else {
            telemetryPayload[field] = payload[field];
          }
        }
      });

      await db.query('INSERT IGNORE INTO telematics_data SET ?', telemetryPayload);
    } catch (error) {
      console.error('[MQTT] Failed to process payload', error.message);
    }
  });
}

module.exports = {
  startMqttListener
};

