const https = require('https');

// 20 confirmed ocean waypoints for wave height (marine model only covers water)
const OCEAN_POINTS = [
  { lat: 48, lon: -128 }, { lat: 44, lon: -126 }, { lat: 38, lon: -124 },
  { lat: 33, lon: -120 }, { lat: 27, lon: -116 }, { lat: 25, lon: -110 },
  { lat: 29, lon: -94  }, { lat: 26, lon: -91  }, { lat: 25, lon: -86  },
  { lat: 24, lon: -82  }, { lat: 28, lon: -90  }, { lat: 30, lon: -87  },
  { lat: 24, lon: -78  }, { lat: 25, lon: -72  }, { lat: 26, lon: -65  },
  { lat: 31, lon: -78  }, { lat: 36, lon: -73  }, { lat: 40, lon: -69  },
  { lat: 43, lon: -64  }, { lat: 47, lon: -60  },
];

// 5° × 5° grid across the full AIS bounding box — wind exists everywhere (land + sea)
const WIND_GRID = (() => {
  const pts = [];
  for (let lat = 25; lat <= 50; lat += 5) {
    for (let lon = -130; lon <= -60; lon += 5) {
      pts.push({ lat, lon });
    }
  }
  return pts; // 6 rows × 15 cols = 90 points
})();

const CACHE_TTL = 60 * 60 * 1000;
let cache = null;
let cacheTime = 0;

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), 12000);
    https
      .get(url, { headers: { 'User-Agent': 'NavalIntelligencePlatform/1.0' } }, (res) => {
        if (res.statusCode !== 200) {
          clearTimeout(timer);
          reject(new Error(`HTTP ${res.statusCode}`));
          res.resume();
          return;
        }
        let raw = '';
        res.on('data', (c) => { raw += c; });
        res.on('end', () => {
          clearTimeout(timer);
          try { resolve(JSON.parse(raw)); }
          catch { reject(new Error('JSON parse error')); }
        });
      })
      .on('error', (e) => { clearTimeout(timer); reject(e); });
  });
}

async function getWeatherData() {
  if (cache && Date.now() - cacheTime < CACHE_TTL) return cache;

  const waveLats = OCEAN_POINTS.map((p) => p.lat).join(',');
  const waveLons = OCEAN_POINTS.map((p) => p.lon).join(',');
  const windLats = WIND_GRID.map((p) => p.lat).join(',');
  const windLons = WIND_GRID.map((p) => p.lon).join(',');

  console.log(`[Weather] Fetching Open-Meteo: ${OCEAN_POINTS.length} wave points, ${WIND_GRID.length} wind points`);

  const [waveRes, windRes] = await Promise.allSettled([
    fetchJSON(`https://marine-api.open-meteo.com/v1/marine?latitude=${waveLats}&longitude=${waveLons}&current=wave_height,wave_direction&timezone=UTC`),
    fetchJSON(`https://api.open-meteo.com/v1/forecast?latitude=${windLats}&longitude=${windLons}&current=wind_speed_10m,wind_direction_10m&timezone=UTC`),
  ]);

  if (waveRes.status === 'rejected') console.error('[Weather] Wave fetch failed:', waveRes.reason?.message);
  if (windRes.status === 'rejected') console.error('[Weather] Wind fetch failed:', windRes.reason?.message);

  const waveArr = waveRes.status === 'fulfilled' && Array.isArray(waveRes.value) ? waveRes.value : [];
  const windArr = windRes.status === 'fulfilled' && Array.isArray(windRes.value) ? windRes.value : [];

  const wavePoints = OCEAN_POINTS.map((p, i) => ({
    lat: p.lat,
    lon: p.lon,
    waveHeight: waveArr[i]?.current?.wave_height ?? null,
    waveDir:    waveArr[i]?.current?.wave_direction ?? null,
  })).filter((p) => p.waveHeight != null);

  const windPoints = WIND_GRID.map((p, i) => ({
    lat: p.lat,
    lon: p.lon,
    windSpeed: windArr[i]?.current?.wind_speed_10m ?? null,
    windDir:   windArr[i]?.current?.wind_direction_10m ?? null,
  })).filter((p) => p.windDir != null);

  const result = { wavePoints, windPoints };
  cache = result;
  cacheTime = Date.now();
  console.log(`[Weather] Cached ${wavePoints.length} wave + ${windPoints.length} wind points`);
  return result;
}

module.exports = { getWeatherData };
