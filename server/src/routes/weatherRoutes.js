const express = require('express');
const { getWeatherData } = require('../services/weather');

const router = express.Router();

router.get('/data', async (req, res) => {
  try {
    const { wavePoints, windPoints } = await getWeatherData();
    res.json({
      waveCount: wavePoints.length,
      windCount: windPoints.length,
      timestamp: new Date().toISOString(),
      wavePoints,
      windPoints,
    });
  } catch (err) {
    console.error('[Weather] Route error:', err.message);
    res.status(500).json({ error: 'Failed to fetch weather data' });
  }
});

module.exports = router;
