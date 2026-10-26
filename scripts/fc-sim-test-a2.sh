#!/usr/bin/env bash
# Test A2: بوت standalone بدون .env در cwd — آیا runtime واقعاً SESSION_SECRET می‌خواند؟
set -u
SIM="$(cd "$(dirname "$0")" && pwd)/fc-sim"
LOG=$SIM/test-a2.log
SIMHOME="${SIMHOME:-$SIM/home}"
mkdir -p "$SIMHOME"
PORT=3179

pkill -f "bun server.js" 2>/dev/null; sleep 1
rm -rf "$SIM/noenv"
cp -r "$SIM/next-service-dist" "$SIM/noenv"
rm -f "$SIM/noenv/.env"   # ← هیچ .env در cwd نیست

cd "$SIM/noenv"
env -i PATH="$PATH" HOME="$SIMHOME" \
  NODE_ENV=production PORT=$PORT HOSTNAME=127.0.0.1 \
  DATABASE_URL="file:$SIM/db/custom.db" \
  BAHAR_DISABLE_SCHEDULER=1 \
  nohup bun server.js > "$LOG" 2>&1 &
PID=$!
sleep 7
echo "GET /                 → $(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:$PORT/ || echo curl-fail)"
RESP=$(curl -s -X POST -H 'Content-Type: application/json' -d '{"username":"0000000000","password":"x"}' http://127.0.0.1:$PORT/api/auth/login || true)
echo "POST /api/auth/login  → $RESP" | head -c 400; echo
sleep 2
kill $PID 2>/dev/null; pkill -f "bun server.js" 2>/dev/null; sleep 1
echo "--- $LOG ---"; tail -15 "$LOG"
if grep -q "SESSION_SECRET" "$LOG"; then
  echo "RESULT: RUNTIME READS ENV DYNAMICALLY — start.sh sourcing fix is REQUIRED ✓"
else
  echo "RESULT: value appears inlined/absent — check log above"
fi
