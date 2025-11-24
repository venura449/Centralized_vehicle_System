# Centralized Vehicle Management System

Single repository that holds the backend API/MQTT ingestor (`backend/`) and the React dashboard (`frontend/`) for a centralized vehicle management platform.

## Features

- Email-based registration & login with hashed passwords and JWT sessions
- MySQL persistence for users, vehicles, and all telemetry frames
- Vehicle management per account (add/describe identifiers that map to MQTT payloads)
- MQTT listener (HiveMQ or any broker) that stores incoming OBD frames automatically
- React dashboard to add vehicles, monitor live/latest data, and inspect historical frames

## Prerequisites

- Node.js 18+
- MySQL 8 (or 5.7+) running and reachable from the backend
- An MQTT broker (defaults to the public HiveMQ broker)

## Backend setup

```bash
cd backend
npm install
# edit src/config.js with your DB/JWT/MQTT values
npm run dev                      # or npm start for production
```

Backend configuration now lives in `backend/src/config.js`. Update:

| Config path | Description |
| --- | --- |
| `server.port` | Port Express should bind to |
| `jwtSecret` | Secret for signing JWTs (use a long random string) |
| `db.*` | MySQL connection settings |
| `mqtt.enabled` | Toggle MQTT ingestion without changing code |
| `mqtt.brokerUrl/topic/clientId` | Broker details for the simulator |

Tables (`users`, `vehicles`, `telematics_data`) are auto-created if they do not exist.

### API quick reference

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/api/auth/register` | Create account (`name`, `email`, `password`) |
| `POST` | `/api/auth/login` | Authenticate and receive JWT |
| `GET` | `/api/vehicles` | List vehicles (requires `Authorization: Bearer <token>`) |
| `POST` | `/api/vehicles` | Add vehicle (`name`, `vehicleIdentifier`, optional `description`) |
| `GET` | `/api/vehicles/:vehicleId/data?limit=50` | Fetch stored telemetry for the vehicle |

## Frontend setup

```bash
cd frontend
cp env.sample .env               # set VITE_API_BASE_URL if backend not on localhost:5000
npm install
npm run dev
```

The dashboard lets a user:

1. Register or log in.
2. Add a vehicle identifier (must match what the MQTT payload sends as `vehicle_id` / `vehicleIdentifier`).
3. Monitor live values and recent MQTT frames for the selected vehicle.

## Publishing MQTT data

Use the provided simulator (Python + `paho-mqtt`). Ensure every payload contains the identifier created in the dashboard. Example modification to the supplied script:

```python
payload_obj = {
    "id": frame_id,                 # unique frame id
    "vehicle_id": "FLEETVAN3",      # must match vehicleIdentifier stored in DB
    "timestamp": ts_ms,
    **obd_data
}
```

Once the backend is running and the MQTT payload includes `vehicle_id`, frames are ingested automatically and appear inside the dashboard within a few seconds.