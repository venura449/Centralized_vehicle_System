const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Joi = require('joi');
const { getPool } = require('../db');
const asyncHandler = require('../utils/asyncHandler');
const config = require('../config');

const router = express.Router();
const db = getPool();

const registerSchema = Joi.object({
  name: Joi.string().min(2).max(120).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(8).max(64).required()
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).max(64).required()
});

router.post(
  '/register',
  asyncHandler(async (req, res) => {
    const { error, value } = registerSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ message: error.message });
    }

    const { name, email, password } = value;
    const [existing] = await db.query(
      'SELECT id FROM users WHERE email = ? LIMIT 1',
      [email]
    );

    if (existing.length) {
      return res.status(409).json({ message: 'Email is already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const [result] = await db.query(
      'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)',
      [name, email, passwordHash]
    );

    const user = { id: result.insertId, name, email };
    const token = jwt.sign(user, config.jwtSecret, { expiresIn: '12h' });

    res.status(201).json({ token, user });
  })
);

router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { error, value } = loginSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ message: error.message });
    }

    const { email, password } = value;
    const [rows] = await db.query(
      'SELECT id, name, email, password_hash FROM users WHERE email = ? LIMIT 1',
      [email]
    );

    if (!rows.length) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const userRecord = rows[0];
    const valid = await bcrypt.compare(password, userRecord.password_hash);
    if (!valid) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const user = {
      id: userRecord.id,
      name: userRecord.name,
      email: userRecord.email
    };

    const token = jwt.sign(user, config.jwtSecret, { expiresIn: '12h' });
    res.json({ token, user });
  })
);

module.exports = router;


