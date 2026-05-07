const express = require('express');
const { getAISStatus, getVesselsByCategory, getMessageCount, getVessels } = require('../services/aisstream');
const { getWeatherStatus } = require('../services/weather');
const { getLogs } = require('../services/logger');

const router = express.Router();

router.get('/health', (req, res) => {
  const vessels = getVessels();
  res.json({
    ais: {
      status: getAISStatus(),
      vesselCount: vessels.length,
      messageCount: getMessageCount(),
      vesselsByCategory: getVesselsByCategory(),
    },
    weather: getWeatherStatus(),
    logs: getLogs(),
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
