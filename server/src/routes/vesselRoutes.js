const express = require('express');
const router = express.Router();
const { getVessels } = require('../services/aisstream');

router.get('/vessels', (req, res) => {
  const vessels = getVessels();
  res.json({
    count: vessels.length,
    timestamp: new Date().toISOString(),
    vessels,
  });
});

module.exports = router;
