#!/usr/bin/env bash
# ============================================================
# بهار | تست E2E دروازه شاد (راند ۱۹-a)
# جریان کامل شبیه‌سازی داخلی + مسیر سوپرادمینِ درون «پنل مدرسه»:
#   1) مدیر: send-code (کد ۵ رقمی) → sign-in → AUTHORIZED INTERNAL
#   2) notice (شماره بیرون مدرسه ۴۰۰ / شماره مدرسه ۲۰۰)
#   3) deliver allPending → results + sweep
#   4) revoke → NO_SESSION روی notice
#   5) سوپرادمین: بدون پنل → NO_SCHOOL؛ enter school → همه مسیرها ۲۰۰
# اجرا: bash scripts/test-shad-e2e.sh [BASE_URL]
# ============================================================
set -u
BASE="${1:-http://localhost:3000}"
PASS=0; FAIL=0
ok()   { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad()  { FAIL=$((FAIL+1)); echo "  ✗ $1"; }
J()    { python3 -c "import sys,json;d=json.load(sys.stdin);print(d$1)" 2>/dev/null; }

echo "— مدیر مدرسه (2000000010) —"
curl -s -c /tmp/shad-mgr.jar -X POST "$BASE/api/auth/login" -H 'content-type: application/json' \
  -d '{"nationalId":"2000000010","password":"demo1234"}' | J "['ok']" | grep -q True && ok "login" || bad "login"

R=$(curl -s -b /tmp/shad-mgr.jar -X POST "$BASE/api/shad/send-code" -H 'content-type: application/json' -d '{"phone":"09120000010"}')
CODE=$(echo "$R" | J "['code']")
echo "$CODE" | grep -qE '^[0-9]{5}$' && ok "send-code → کد ۵ رقمی ($CODE)" || bad "send-code: $R"
curl -s -b /tmp/shad-mgr.jar -X POST "$BASE/api/shad/send-code" -H 'content-type: application/json' -d '{"phone":"12345"}' \
  | J "['error']['code']" | grep -q BAD_PHONE && ok "send-code شماره نامعتبر → 400 BAD_PHONE" || bad "BAD_PHONE"

R=$(curl -s -b /tmp/shad-mgr.jar -X POST "$BASE/api/shad/sign-in" -H 'content-type: application/json' -d '{"phone":"09120000010","code":"00000"}')
echo "$R" | J "['error']['code']" | grep -q PHONE_CODE_INVALID && ok "sign-in کد غلط → PHONE_CODE_INVALID" || bad "کد غلط: $R"
R=$(curl -s -b /tmp/shad-mgr.jar -X POST "$BASE/api/shad/sign-in" -H 'content-type: application/json' -d "{\"phone\":\"09120000010\",\"code\":\"$CODE\"}")
echo "$R" | J "['ok']" | grep -q True && ok "sign-in کد درست → AUTHORIZED" || bad "sign-in: $R"
curl -s -b /tmp/shad-mgr.jar "$BASE/api/shad/status" | J "['connected']" | grep -q True && ok "status → connected INTERNAL" || bad "status"

curl -s -b /tmp/shad-mgr.jar -X POST "$BASE/api/shad/notice" -H 'content-type: application/json' -d '{"to":"09121111111","text":"سلام"}' \
  | J "['error']['code']" | grep -q BAD_RECIPIENT && ok "notice شماره بیرون مدرسه → 400 BAD_RECIPIENT" || bad "BAD_RECIPIENT"
curl -s -b /tmp/shad-mgr.jar -X POST "$BASE/api/shad/notice" -H 'content-type: application/json' -d '{"to":"09120000101","text":"تست E2E شاد"}' \
  | J "['ok']" | grep -q True && ok "notice شماره مدرسه → SENT" || bad "notice"

curl -s -b /tmp/shad-mgr.jar -X POST "$BASE/api/shad/deliver" -H 'content-type: application/json' -d '{"allPending":true}' \
  | J "['results'][0]['ok']" | grep -q True && ok "deliver allPending → results + sweep" || bad "deliver"

curl -s -b /tmp/shad-mgr.jar -X POST "$BASE/api/shad/revoke" | J "['ok']" | grep -q True && ok "revoke" || bad "revoke"
curl -s -b /tmp/shad-mgr.jar -X POST "$BASE/api/shad/notice" -H 'content-type: application/json' -d '{"to":"09120000101","text":"بعد از قطع"}' \
  | J "['error']['code']" | grep -q NO_SESSION && ok "بعد از revoke → NO_SESSION" || bad "NO_SESSION"

echo "— سوپرادمین (1000000011) —"
curl -s -c /tmp/shad-sa.jar -X POST "$BASE/api/auth/login" -H 'content-type: application/json' \
  -d '{"nationalId":"1000000011","password":"demo1234"}' | J "['ok']" | grep -q True && ok "login" || bad "login"
curl -s -b /tmp/shad-sa.jar -X POST "$BASE/api/shad/send-code" -H 'content-type: application/json' -d '{"phone":"09120000010"}' \
  | J "['error']['code']" | grep -q NO_SCHOOL && ok "بدون پنل مدرسه → 400 NO_SCHOOL (نه 403)" || bad "NO_SCHOOL"

SCHOOL=$(curl -s -b /tmp/shad-sa.jar "$BASE/api/schools" | J "[0]['id']" 2>/dev/null)
[ -z "$SCHOOL" ] && SCHOOL="cmu31j2c00007vv86k2vwdmtw"
curl -s -b /tmp/shad-sa.jar -c /tmp/shad-sa.jar -X POST "$BASE/api/schools/$SCHOOL/enter" | J "['ok']" | grep -q True && ok "enter school panel" || bad "enter"

R=$(curl -s -b /tmp/shad-sa.jar -X POST "$BASE/api/shad/send-code" -H 'content-type: application/json' -d '{"phone":"09120000010"}')
CODE=$(echo "$R" | J "['code']")
[ -n "$CODE" ] && ok "send-code در پنل → کد $CODE" || bad "send-code در پنل: $R"
curl -s -b /tmp/shad-sa.jar -X POST "$BASE/api/shad/sign-in" -H 'content-type: application/json' -d "{\"phone\":\"09120000010\",\"code\":\"$CODE\"}" \
  | J "['ok']" | grep -q True && ok "sign-in در پنل → AUTHORIZED" || bad "sign-in در پنل"
curl -s -b /tmp/shad-sa.jar -X POST "$BASE/api/shad/deliver" -H 'content-type: application/json' -d '{"allPending":true}' \
  | J "['results'][0]['ok']" | grep -q True && ok "deliver در پنل" || bad "deliver در پنل"
curl -s -b /tmp/shad-sa.jar -X POST "$BASE/api/shad/notice" -H 'content-type: application/json' -d '{"to":"09120000101","text":"تست سوپرادمین در پنل"}' \
  | J "['ok']" | grep -q True && ok "notice در پنل" || bad "notice در پنل"
curl -s -b /tmp/shad-sa.jar -X POST "$BASE/api/shad/revoke" | J "['ok']" | grep -q True && ok "revoke در پنل" || bad "revoke در پنل"
curl -s -b /tmp/shad-sa.jar "$BASE/api/shad/outbox" | J "['outbox'][0]['status']" | grep -q SENT && ok "outbox (مدرسهٔ فعال)" || bad "outbox"

# بازگرداندن وضعیت: نشست مدرسه ۱ دوباره AUTHORIZED شود
R=$(curl -s -b /tmp/shad-mgr.jar -X POST "$BASE/api/shad/send-code" -H 'content-type: application/json' -d '{"phone":"09120000010"}')
CODE=$(echo "$R" | J "['code']")
curl -s -b /tmp/shad-mgr.jar -X POST "$BASE/api/shad/sign-in" -H 'content-type: application/json' -d "{\"phone\":\"09120000010\",\"code\":\"$CODE\"}" >/dev/null
curl -s -b /tmp/shad-mgr.jar "$BASE/api/shad/status" | J "['connected']" | grep -q True && ok "بازیابی وضعیت: نشست AUTHORIZED" || bad "بازیابی وضعیت"

echo
echo "نتیجه: $PASS موفق / $FAIL ناموفق"
[ "$FAIL" -eq 0 ]
