const { execSync } = require('child_process');

const defaultPorts = [3000, 5173];
const ports = process.argv
  .slice(2)
  .map((v) => Number(v))
  .filter((v) => Number.isInteger(v) && v > 0);

const targetPorts = ports.length > 0 ? ports : defaultPorts;

function unique(values) {
  return [...new Set(values)];
}

function getListeningPidsWin(port) {
  try {
    const out = execSync('netstat -ano -p tcp', { stdio: ['ignore', 'pipe', 'ignore'] }).toString();
    const lines = out.split(/\r?\n/);
    const pids = [];
    for (const line of lines) {
      const normalized = line.trim().replace(/\s+/g, ' ');
      if (!normalized.startsWith('TCP ')) continue;
      const parts = normalized.split(' ');
      if (parts.length < 5) continue;
      const localAddress = parts[1] || '';
      const state = parts[3] || '';
      const pid = Number(parts[4]);
      if (!Number.isInteger(pid)) continue;
      if (pid === process.pid) continue;
      if (!localAddress.endsWith(`:${port}`)) continue;
      if (state !== 'LISTENING') continue;
      pids.push(pid);
    }
    return unique(pids);
  } catch {
    return [];
  }
}

function getListeningPidsUnix(port) {
  try {
    const out = execSync(`lsof -ti tcp:${port} -sTCP:LISTEN`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString();
    return unique(
      out
        .split(/\r?\n/)
        .map((line) => Number(line.trim()))
        .filter((pid) => Number.isInteger(pid) && pid > 0 && pid !== process.pid),
    );
  } catch {
    return [];
  }
}

function killPidWin(pid) {
  execSync(`taskkill /PID ${pid} /T /F`, { stdio: ['ignore', 'ignore', 'ignore'] });
}

function killPidUnix(pid) {
  execSync(`kill -9 ${pid}`, { stdio: ['ignore', 'ignore', 'ignore'] });
}

function clearPort(port) {
  const pids = process.platform === 'win32' ? getListeningPidsWin(port) : getListeningPidsUnix(port);
  if (pids.length === 0) {
    console.log(`[dev-ports] Port ${port}: free`);
    return;
  }

  for (const pid of pids) {
    try {
      if (process.platform === 'win32') killPidWin(pid);
      else killPidUnix(pid);
      console.log(`[dev-ports] Port ${port}: killed PID ${pid}`);
    } catch {
      console.warn(`[dev-ports] Port ${port}: failed to kill PID ${pid}`);
    }
  }
}

for (const port of targetPorts) {
  clearPort(port);
}