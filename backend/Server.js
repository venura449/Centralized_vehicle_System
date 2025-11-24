const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const { initDb } = require('./src/db');
const authRoutes = require('./src/routes/auth');
const vehiclesRoutes = require('./src/routes/vehicles');
const authenticate = require('./src/middleware/auth');
const { startMqttListener } = require('./src/mqtt/listener');
const config = require('./src/config');

const app = express();
const PORT = config.server.port || 5000;

if (!config.jwtSecret || config.jwtSecret === 'replace_this_with_a_long_random_string') {
  throw new Error(
    'Set jwtSecret in src/config.js to a secure random string before starting the server.'
  );
}

app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(morgan('tiny'));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

app.use('/api/auth', authRoutes);
app.use('/api/vehicles', authenticate, vehiclesRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  res
    .status(err.status || 500)
    .json({ message: err.message || 'Internal server error' });
});

async function bootstrap() {
  await initDb();
  startMqttListener();

  app.listen(PORT, () => {
    console.log(`API listening on port ${PORT}`);
  });
}

bootstrap().catch((error) => {
  console.error('Failed to start backend', error);
  process.exit(1);
});

