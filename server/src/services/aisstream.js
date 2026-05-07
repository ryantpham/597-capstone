const WebSocket = require('ws');
const { pushLog } = require('./logger');

const vesselMap = new Map();
let ws = null;
let reconnectTimeout = null;
const RECONNECT_INTERVAL = 10000;
let receivedData = false;
let messageCount = 0;
let aisStatus = 'disconnected';

// AIS ship type codes → category
function getShipCategory(typeCode) {
  if (typeCode >= 70 && typeCode <= 79) return 'Cargo';
  if (typeCode >= 80 && typeCode <= 89) return 'Tanker';
  if (typeCode >= 60 && typeCode <= 69) return 'Passenger';
  if (typeCode === 30) return 'Fishing';
  if (typeCode === 31 || typeCode === 32) return 'Towing';
  if (typeCode === 33) return 'Dredging';
  if (typeCode === 34) return 'Diving';
  if (typeCode === 35) return 'Military';
  if (typeCode === 36) return 'Sailing';
  if (typeCode === 37) return 'Pleasure Craft';
  if (typeCode >= 40 && typeCode <= 49) return 'High Speed Craft';
  if (typeCode === 50) return 'Pilot Vessel';
  if (typeCode === 51) return 'Search & Rescue';
  if (typeCode === 52) return 'Tug';
  if (typeCode === 53) return 'Port Tender';
  if (typeCode === 55) return 'Law Enforcement';
  if (typeCode === 58) return 'Medical';
  if (typeCode >= 90 && typeCode <= 99) return 'Other';
  return 'Unknown';
}

function startAISStream() {
  if (ws && ws.readyState === WebSocket.OPEN) return;

  console.log('[AIS] Connecting to AISStream.io...');
  pushLog('AIS', 'info', 'Connecting to AISStream.io...');
  aisStatus = 'connecting';
  ws = new WebSocket('wss://stream.aisstream.io/v0/stream');
  receivedData = false;

  ws.on('open', () => {
    console.log('[AIS] Connected — sending subscription');
    pushLog('AIS', 'info', 'Connected — subscription sent (bbox: 24–50N, 130–60W)');
    aisStatus = 'connected';

    const subscription = {
      APIKey: process.env.AISSTREAM_API_KEY,
      BoundingBoxes: [[[24, -130], [50, -60]]],
      FilterMessageTypes: ['PositionReport', 'ShipStaticData'],
    };
    ws.send(JSON.stringify(subscription));
  });

  ws.on('message', (data) => {
    try {
      const parsed = JSON.parse(data);

      if (!receivedData) {
        receivedData = true;
        console.log('[AIS] Receiving vessel data...');
        pushLog('AIS', 'info', 'Live vessel data stream active');
      }

      messageCount++;
      const meta = parsed.MetaData;

      if (parsed.MessageType === 'PositionReport') {
        const report = parsed.Message.PositionReport;
        const existing = vesselMap.get(meta.MMSI) || {};

        vesselMap.set(meta.MMSI, {
          ...existing,
          mmsi: meta.MMSI,
          shipName: meta.ShipName ? meta.ShipName.trim() : existing.shipName || 'Unknown',
          latitude: meta.latitude,
          longitude: meta.longitude,
          cog: report.Cog,
          sog: report.Sog,
          trueHeading: report.TrueHeading,
          navStatus: report.NavigationalStatus,
          timeUtc: meta.time_utc,
          lastUpdated: Date.now(),
        });
      }

      if (parsed.MessageType === 'ShipStaticData') {
        const staticData = parsed.Message.ShipStaticData;
        const existing = vesselMap.get(meta.MMSI) || {};
        const typeCode = staticData.Type || 0;

        vesselMap.set(meta.MMSI, {
          ...existing,
          mmsi: meta.MMSI,
          shipName: staticData.Name ? staticData.Name.trim() : existing.shipName || 'Unknown',
          imoNumber: staticData.ImoNumber || existing.imoNumber,
          callSign: staticData.CallSign ? staticData.CallSign.trim() : existing.callSign,
          shipType: typeCode,
          shipCategory: getShipCategory(typeCode),
          destination: staticData.Destination ? staticData.Destination.trim() : existing.destination,
          lastUpdated: existing.lastUpdated || Date.now(),
        });
      }
    } catch (err) {
      console.error('[AIS] Parse error:', err.message);
      pushLog('AIS', 'error', `Parse error: ${err.message}`);
    }
  });

  ws.on('close', (code) => {
    aisStatus = 'reconnecting';
    if (receivedData) {
      console.log(`[AIS] Disconnected (code: ${code}) after ${messageCount} messages. Reconnecting...`);
      pushLog('AIS', 'warn', `Disconnected (code ${code}) after ${messageCount} messages — reconnecting in 10s`);
    }
    ws = null;
    scheduleReconnect();
  });

  ws.on('error', (err) => {
    console.error('[AIS] WebSocket error:', err.message);
    pushLog('AIS', 'error', `WebSocket error: ${err.message}`);
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
  return Array.from(vesselMap.values()).filter((v) => v.latitude != null);
}

function getVesselCount() {
  return vesselMap.size;
}

function getAISStatus() {
  return aisStatus;
}

function getVesselsByCategory() {
  const counts = {};
  for (const vessel of vesselMap.values()) {
    if (vessel.latitude == null) continue;
    const cat = vessel.shipCategory || 'Unknown';
    counts[cat] = (counts[cat] || 0) + 1;
  }
  return counts;
}

function getMessageCount() {
  return messageCount;
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
    pushLog('AIS', 'info', `Pruned ${removed} stale tracks — ${vesselMap.size} vessels active`);
  }
}, 60000);

// Log stats every 30 seconds while connected
setInterval(() => {
  if (vesselMap.size > 0) {
    console.log(`[AIS] Active vessels: ${vesselMap.size} | Messages received: ${messageCount}`);
    pushLog('AIS', 'info', `Active vessels: ${vesselMap.size} | Total messages: ${messageCount.toLocaleString()}`);
  }
}, 30000);

module.exports = { startAISStream, getVessels, getVesselCount, getAISStatus, getVesselsByCategory, getMessageCount };
