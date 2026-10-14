const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const { jwtSecret } = require('../secret');

// POST /auth/login  — body: { username, password }
router.post('/login', async (req, res) => {
  const { username, password } = req.body ?? {};

  if (!username || !password) {
    return res.status(400).json({ code: 'CREDENTIALS_REQUIRED' });
  }

  try {
    const result = await pool.query(
      'SELECT password_hash FROM admin_users WHERE username = $1',
      [username]
    );

    if (result.rowCount === 0) {
      // Deliberate vague message to avoid username enumeration
      return res.status(401).json({ code: 'INVALID_CREDENTIALS' });
    }

    const { password_hash } = result.rows[0];
    const match = await bcrypt.compare(password, password_hash);

    if (!match) {
      return res.status(401).json({ code: 'INVALID_CREDENTIALS' });
    }

    const token = jwt.sign({ username }, jwtSecret, { expiresIn: '8h' });
    return res.json({ token });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ code: 'INTERNAL_SERVER_ERROR' });
  }
});

module.exports = router;
