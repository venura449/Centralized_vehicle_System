/**
 * Update the values below to match your environment.
 * No .env file is required—these values are read directly by the server.
 */
const config = {
  server: {
    port: 4000
  },
  jwtSecret: 'yuyuubgdrdreplacethiswithalongrandomstring',
  db: {
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: '',
    database: 'vehicle_db'
  },
  mqtt: {
    enabled: true,
    brokerUrl: 'mqtt://broker.hivemq.com:1883',
    topic: 'car/obd/data',
    clientId: 'vehicle-backend-listener'
  }
};

module.exports = config;



