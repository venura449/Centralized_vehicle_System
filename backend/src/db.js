const mysql = require('mysql2/promise');
const config = require('./config');

let pool;

function validateConfig() {
  const { db } = config;
  const requiredKeys = ['host', 'port', 'user', 'database'];
  const missing = requiredKeys.filter((key) => db[key] === undefined || db[key] === '');
  if (missing.length) {
    throw new Error(
      `Missing required database config values in src/config.js: ${missing.join(', ')}`
    );
  }
}

function getPool() {
  if (pool) {
    return pool;
  }

  validateConfig();
  pool = mysql.createPool({
    host: config.db.host,
    port: Number(config.db.port),
    user: config.db.user,
    password: config.db.password,
    database: config.db.database,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });

  return pool;
}

async function initDb() {
  const db = getPool();

  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(120) NOT NULL,
      email VARCHAR(191) NOT NULL UNIQUE,
      password_hash VARCHAR(191) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS vehicles (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      name VARCHAR(150) NOT NULL,
      vehicle_identifier VARCHAR(64) NOT NULL UNIQUE,
      description VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_vehicle_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS telematics_data (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      vehicle_id INT NOT NULL,
      frame_id VARCHAR(64) NOT NULL UNIQUE,
      timestamp_ms BIGINT,
      rpm INT,
      speed INT,
      coolant_temp INT,
      timing_advance DECIMAL(6,2),
      intake_temp INT,
      maf DECIMAL(10,2),
      throttle DECIMAL(6,2),
      engine_load DECIMAL(6,2),
      manifold_pressure INT,
      o2_voltage DECIMAL(6,3),
      lambda_value DECIMAL(6,3),
      o2_voltage_b1s2 DECIMAL(6,3),
      lambda_b1s2 DECIMAL(6,3),
      wideband_lambda DECIMAL(6,3),
      wideband_voltage DECIMAL(6,3),
      afr DECIMAL(6,2),
      short_fuel_trim DECIMAL(6,2),
      long_fuel_trim DECIMAL(6,2),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_telematics_vehicle
        FOREIGN KEY (vehicle_id)
        REFERENCES vehicles(id)
        ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  return db;
}

module.exports = {
  getPool,
  initDb
};


