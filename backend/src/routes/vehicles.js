const express = require('express');
const Joi = require('joi');
const { getPool } = require('../db');
const asyncHandler = require('../utils/asyncHandler');
const { normalizeTelemetryRow } = require('../utils/telemetry');

const router = express.Router();
const db = getPool();

const vehicleSchema = Joi.object({
  name: Joi.string().min(2).max(150).required(),
  vehicleIdentifier: Joi.string()
    .pattern(/^[A-Za-z0-9_-]+$/)
    .min(4)
    .max(64)
    .required(),
  description: Joi.string().allow('', null).max(255)
});

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const [vehicles] = await db.query(
      `
        SELECT id, name, vehicle_identifier AS vehicleIdentifier, description, created_at AS createdAt
        FROM vehicles
        WHERE user_id = ?
        ORDER BY created_at DESC
      `,
      [userId]
    );

    if (!vehicles.length) {
      return res.json([]);
    }

    const vehicleIds = vehicles.map((v) => v.id);

    const [latestReadings] = await db.query(
      `
        SELECT td.*
        FROM telematics_data td
        INNER JOIN (
          SELECT vehicle_id, MAX(timestamp_ms) AS latest_ts
          FROM telematics_data
          WHERE vehicle_id IN (?)
          GROUP BY vehicle_id
        ) latest
        ON latest.vehicle_id = td.vehicle_id AND latest.latest_ts = td.timestamp_ms
      `,
      [vehicleIds]
    );

    const latestMap = latestReadings.reduce((acc, row) => {
      acc[row.vehicle_id] = row;
      return acc;
    }, {});

    const payload = vehicles.map((vehicle) => ({
      ...vehicle,
      latestData: normalizeTelemetryRow(latestMap[vehicle.id]) || null
    }));

    res.json(payload);
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { error, value } = vehicleSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ message: error.message });
    }

    const userId = req.user.id;
    const { name, vehicleIdentifier, description } = value;

    const [existing] = await db.query(
      'SELECT id FROM vehicles WHERE vehicle_identifier = ? LIMIT 1',
      [vehicleIdentifier]
    );

    if (existing.length) {
      return res
        .status(409)
        .json({ message: 'Vehicle identifier already in use' });
    }

    const [result] = await db.query(
      'INSERT INTO vehicles (user_id, name, vehicle_identifier, description) VALUES (?, ?, ?, ?)',
      [userId, name, vehicleIdentifier, description || null]
    );

    res.status(201).json({
      id: result.insertId,
      name,
      vehicleIdentifier,
      description: description || null
    });
  })
);

router.get(
  '/:vehicleId/data',
  asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const vehicleId = Number(req.params.vehicleId);
    const limit = Math.min(Number(req.query.limit) || 50, 200);

    const [vehicles] = await db.query(
      'SELECT id FROM vehicles WHERE id = ? AND user_id = ? LIMIT 1',
      [vehicleId, userId]
    );

    if (!vehicles.length) {
      return res.status(404).json({ message: 'Vehicle not found' });
    }

    const [telemetry] = await db.query(
      `
        SELECT *
        FROM telematics_data
        WHERE vehicle_id = ?
        ORDER BY timestamp_ms DESC
        LIMIT ?
      `,
      [vehicleId, limit]
    );

    res.json(telemetry.map(normalizeTelemetryRow));
  })
);

module.exports = router;

