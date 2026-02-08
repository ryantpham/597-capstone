const WebSocket = require('ws');

const vesselMap = new Map();
let ws = null;
let reconnectTimeout = null;
const RECONNECT_INTERVAL = 10000;
let receivedData = false;
let messageCount = 0;

function startAISStream() {
  if (ws && ws.readyState === WebSocket.OPEN) return;

  console.log('[AIS] Connecting to AISStream.io...');
  ws = new WebSocket('wss://stream.aisstream.io/v0/stream');
  receivedData = false;

  ws.on('open', () => {
    console.log('[AIS] Connected — sending subscription');

    const subscription = {
      APIKey: process.env.AISSTREAM_API_KEY,
      BoundingBoxes: [[[24, -130], [50, -60]]],
      FilterMessageTypes: ['PositionReport'],
    };
    ws.send(JSON.stringify(subscription));
  });

  ws.on('message', (data) => {
    try {
      const parsed = JSON.parse(data);
      if (parsed.MessageType !== 'PositionReport') return;

      if (!receivedData) {
        receivedData = true;
        console.log('[AIS] Receiving vessel data...');
      }

      messageCount++;
      const meta = parsed.MetaData;
      const report = parsed.Message.PositionReport;

      vesselMap.set(meta.MMSI, {
        mmsi: meta.MMSI,
        shipName: meta.ShipName ? meta.ShipName.trim() : 'Unknown',
        latitude: meta.latitude,
        longitude: meta.longitude,
        cog: report.Cog,
        sog: report.Sog,
        trueHeading: report.TrueHeading,
        navStatus: report.NavigationalStatus,
        timeUtc: meta.time_utc,
        lastUpdated: Date.now(),
      });
    } catch (err) {
      console.error('[AIS] Parse error:', err.message);
    }
  });

  ws.on('close', (code) => {
    if (receivedData) {
      console.log(`[AIS] Disconnected (code: ${code}) after ${messageCount} messages. Reconnecting...`);
    }
    ws = null;
    scheduleReconnect();
  });

  ws.on('error', (err) => {
    console.error('[AIS] WebSocket error:', err.message);
    if (ws) ws.close();
  });
}

function scheduleReconnect() {
  if (reconnectTimeout) return;
  reconnectTimeout = setTimeout(() => {
    reconnectTimeout = null;
    startAISStream();
  }, RECONNECT_INTERVAL);
}

function getVessels() {
  return Array.from(vesselMap.values());
}

function getVesselCount() {
  return vesselMap.size;
}

// Clean stale entries older than 5 minutes
setInterval(() => {
  const cutoff = Date.now() - 5 * 60 * 1000;
  let removed = 0;
  for (const [mmsi, vessel] of vesselMap) {
    if (vessel.lastUpdated < cutoff) {
      vesselMap.delete(mmsi);
      removed++;
    }
  }
  if (removed > 0) {
    console.log(`[AIS] Cleaned ${removed} stale entries. Active vessels: ${vesselMap.size}`);
  }
}, 60000);

// Log stats every 30 seconds while connected
setInterval(() => {
  if (vesselMap.size > 0) {
    console.log(`[AIS] Active vessels: ${vesselMap.size} | Messages received: ${messageCount}`);
  }
}, 30000);

module.exports = { startAISStream, getVessels, getVesselCount };
