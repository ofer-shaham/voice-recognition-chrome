#!/usr/bin/env bash
# Free port 3001 if a stale process is holding it, then start the server.
# Uses /proc/net/tcp(6) so it works without lsof or fuser.

PORT=3001
PORT_HEX=$(printf '%04X' $PORT)

node - <<'JSEOF'
const fs   = require('fs');
const port = 3001;
const hex  = port.toString(16).toUpperCase().padStart(4, '0');

let inode = null;
for (const f of ['/proc/net/tcp6', '/proc/net/tcp']) {
  try {
    for (const line of fs.readFileSync(f, 'utf8').split('\n').slice(1)) {
      const parts = line.trim().split(/\s+/);
      if (parts.length < 10) continue;
      const portField = (parts[1] || '').split(':')[1];
      if (portField && parseInt(portField, 16) === port) {
        inode = parts[9];
        break;
      }
    }
  } catch (_) {}
  if (inode) break;
}

if (inode && inode !== '0') {
  for (const pid of fs.readdirSync('/proc').filter(d => /^\d+$/.test(d))) {
    try {
      for (const fd of fs.readdirSync(`/proc/${pid}/fd`)) {
        try {
          if (fs.readlinkSync(`/proc/${pid}/fd/${fd}`) === `socket:[${inode}]`) {
            process.kill(Number(pid), 'SIGKILL');
            console.log(`[start.sh] Killed stale PID ${pid} holding port ${port}`);
          }
        } catch (_) {}
      }
    } catch (_) {}
  }
} else {
  console.log(`[start.sh] Port ${port} is free`);
}
JSEOF

sleep 0.3
exec node server/index.js
