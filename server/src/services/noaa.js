const https = require('https');

const BBOX = { latMin: 24, latMax: 50, lonMin: -130, lonMax: -60 };
const CACHE_TTL = 30 * 60 * 1000;
const MAX_STATIONS = 50;
const REQUEST_TIMEOUT = 8000;

let cache = null;
let cacheTime = 0;

function fetchText(url) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), REQUEST_TIMEOUT);
    https
      .get(url, { headers: { 'User-Agent': 'NavalIntelligencePlatform/1.0' } }, (res) => {
        if (res.statusCode !== 200) {
          clearTimeout(timer);
          reject(new Error(`HTTP ${res.statusCode}`));
          res.resume();
          return;
        }
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => { clearTimeout(timer); resolve(data); });
      })
      .on('error', (err) => { clearTimeout(timer); reject(err); });
  });
}

function parseStations(xml) {
  const stations = [];
  const stationRe = /<station\s+([^>]+?)\/>/g;
  let match;
  while ((match = stationRe.exec(xml)) !== null) {
    const attrs = {};
    const attrRe = /(\w+)="([^"]*)"/g;
    let a;
    while ((a = attrRe.exec(match[1])) !== null) attrs[a[1]] = a[2];
    if (attrs.met !== 'y') continue;
    const lat = parseFloat(attrs.lat);
    const lon = parseFloat(attrs.lon);
    if (isNaN(lat) || isNaN(lon)) continue;
    if (lat < BBOX.latMin || lat > BBOX.latMax || lon < BBOX.lonMin || lon > BBOX.lonMax) continue;
    stations.push({ id: attrs.id, lat, lon });
  }
  return stations;
}

function parseObs(text) {
  const lines = text.split('\n');
  const headerLine = lines.find((l) => l.startsWith('#YY'));
  if (!headerLine) return null;
  const headers = headerLine.replace(/^#\s*/, '').trim().split(/\s+/);
  const dataLine = lines.find((l) => l.trim() && !l.startsWith('#'));
  if (!dataLine) return null;
  const values = dataLine.trim().split(/\s+/);
  const MISSING = new Set(['MM', 'N/A', '999', '9999']);
  const get = (key) => {
    const idx = headers.indexOf(key);
    if (idx < 0 || idx >= values.length) return null;
    return MISSING.has(values[idx]) ? null : parseFloat(values[idx]);
  };
  return {
    waveHeight: get('WVHT'),
    windDir: get('WDIR'),
    windSpeed: get('WSPD'),
  };
}

async function getBuoyData() {
  if (cache && Date.now() - cacheTime < CACHE_TTL) return cache;

  let xml;
  try {
    xml = await fetchText('https://www.ndbc.noaa.gov/activestations.xml');
  } catch (err) {
    console.error('[NOAA] Failed to fetch station list:', err.message);
    return cache || [];
  }

  const stations = parseStations(xml).slice(0, MAX_STATIONS);
  console.log(`[NOAA] Fetching observations for ${stations.length} stations`);

  const results = await Promise.allSettled(
    stations.map(async (s) => {
      try {
        const text = await fetchText(`https://www.ndbc.noaa.gov/data/realtime2/${s.id}.txt`);
        const obs = parseObs(text);
        if (!obs || (obs.waveHeight === null && obs.windDir === null)) return null;
        return { lat: s.lat, lon: s.lon, id: s.id, ...obs };
      } catch {
        return null;
      }
    })
  );

  const buoys = results
    .filter((r) => r.status === 'fulfilled' && r.value !== null)
    .map((r) => r.value);

  cache = buoys;
  cacheTime = Date.now();
  console.log(`[NOAA] Cached ${buoys.length} buoy observations`);
  return buoys;
}

module.exports = { getBuoyData };
