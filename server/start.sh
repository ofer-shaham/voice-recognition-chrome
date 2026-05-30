#!/usr/bin/env bash
pkill -f "node.*server/index" 2>/dev/null
fuser -k 3001/tcp 2>/dev/null
sleep 1
exec node /home/runner/workspace/server/index.js
