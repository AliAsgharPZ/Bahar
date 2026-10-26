#!/usr/bin/env bash
# بهار | شبیه‌ساز محیط دیپلوی (FC) برای تأیید بوتِ پکیج standalone
# Test A: بوت بدون SESSION_SECRET + hit به API → باید خطای SESSION_SECRET بدهد
# Test B: بوت با .env بسته‌بندی‌شده (semantics جدید start.sh) → باید کامل بالا بیاید
set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SIM=$ROOT/scripts/fc-sim
SIMHOME="${SIMHOME:-$SIM/home}"
mkdir -p "$SIMHOME"
NEX=$SIM/next-service-dist
DB=$SIM/db/custom.db
PA=3177
PB=3178

pkill -f "bun server.js" 2>/dev/null; sleep 1
rm -rf "$SIM"
mkdir -p "$SIM"

echo "=== [setup] package layout ==="
cp -r "$ROOT/.next/standalone" "$NEX"
grep -v -E '^(DATABASE_URL=|#.*|\s*$)' "$ROOT/.env" > "$NEX/.env" || true
chmod 600 "$NEX/.env"
echo "packaged .env (masked): $(sed 's/SESSION_SECRET=.*/SESSION_SECRET=<redacted>/' "$NEX/.env" | tr '\n' ' ')"
mkdir -p "$SIM/db"
cp -a "$ROOT/db/." "$SIM/db/"
du -sh "$NEX" "$SIM/db"

echo; echo "=== [Test A] WITHOUT SESSION_SECRET — expect SESSION_SECRET crash on API hit ==="
( cd "$NEX" && env -i PATH="$PATH" HOME="$SIMHOME" \
    NODE_ENV=production PORT=$PA HOSTNAME=127.0.0.1 \
    DATABASE_URL="file:$DB" BAHAR_DISABLE_SCHEDULER=1 \
    nohup bun server.js > "$SIM/test-a.log" 2>&1 & echo $! > "$SIM/test-a.pid" )
sleep 6
curl -s -o /dev/null -w "GET /            → %{http_code}\n" "http://127.0.0.1:$PA/" || true
curl -s -o /dev/null -w "POST /api/auth/login → %{http_code}\n" -X POST -H 'Content-Type: application/json' \
  -d '{"username":"0000000000","password":"x"}' "http://127.0.0.1:$PA/api/auth/login" || true
sleep 2
kill $(cat "$SIM/test-a.pid" 2>/dev/null) 2>/dev/null
pkill -f "bun server.js" 2>/dev/null; sleep 1
echo "--- test-a.log tail ---"; tail -8 "$SIM/test-a.log"
grep -q "SESSION_SECRET" "$SIM/test-a.log" && echo "TEST A PASS ✓ (crash reproduced: missing SESSION_SECRET)" || echo "TEST A FAIL ✗"

echo; echo "=== [Test B] WITH packaged .env (start.sh semantics) — expect fully UP ==="
( cd "$NEX" && env -i PATH="$PATH" HOME="$SIMHOME" \
    bash -c '
      set -a; . ./.env; set +a
      export NODE_ENV=production PORT='"$PB"' HOSTNAME=127.0.0.1
      export DATABASE_URL="file:'"$DB"'"
      export BAHAR_DISABLE_SCHEDULER=1
      exec bun server.js
    ' > "$SIM/test-b.log" 2>&1 & echo $! > "$SIM/test-b.pid" )
for i in $(seq 1 25); do
  curl -s -o /dev/null --connect-timeout 2 "http://127.0.0.1:$PB/" && break
  sleep 1
done
echo "--- Test B endpoints ---"
for p in / /login /plans /blog /languages; do
  echo "GET $p → $(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PB$p")"
done
code=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H 'Content-Type: application/json' \
  -d '{"username":"0000000000","password":"wrong-password-xyz"}' "http://127.0.0.1:$PB/api/auth/login")
echo "POST /api/auth/login (bad creds) → $code   (401 = auth module loaded, no crash)"
kill $(cat "$SIM/test-b.pid" 2>/dev/null) 2>/dev/null
pkill -f "bun server.js" 2>/dev/null; sleep 1
echo "--- test-b.log tail ---"; tail -6 "$SIM/test-b.log"
grep -qi "SESSION_SECRET تنظیم نشده\|SESSION_SECRET is" "$SIM/test-b.log" && echo "TEST B FAIL ✗ (still crashing)" || echo "TEST B PASS ✓ (booted clean, no SESSION_SECRET error)"
