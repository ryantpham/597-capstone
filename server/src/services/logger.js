const MAX_LOGS = 150;
const logs = [];

function pushLog(source, level, message) {
  logs.push({ time: new Date().toISOString(), source, level, message });
  if (logs.length > MAX_LOGS) logs.shift();
}

function getLogs() {
  return [...logs];
}

module.exports = { pushLog, getLogs };
