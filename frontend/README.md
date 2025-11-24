# Frontend (React dashboard)

## Getting started

```bash
cd frontend
cp env.sample .env          # optional, defaults to http://localhost:5000
npm install
npm run dev
```

### Features

- Email login/register UI that talks to `/api/auth/*`
- Vehicle management (list/add vehicles tied to the authenticated user)
- Live telemetry cards + rolling history table per vehicle
- Manual refresh buttons plus background polling every 5 seconds

The dashboard reads `VITE_API_BASE_URL` (defaults to `http://localhost:5000`) to contact the backend.

### Folder hints

- `src/services/api.js` – Axios client with auth header injection
- `src/App.jsx` – All views (auth, vehicle list, telemetry) + polling logic
- `src/App.css` – Tailored styles for the dashboard UI
