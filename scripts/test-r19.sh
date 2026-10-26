#!/bin/bash
# ============================================================
# بهار | تست E2E راند ۱۹ — سوپرادمین در پنل مدرسه + کپچا + تلگرام
# اجرا: bash scripts/test-r19.sh
# ============================================================
set -u
BASE="http://localhost:3000"
JAR="/tmp/r19-cookies.txt"
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }

echo "── ۱) ورود سوپرادمین"
rm -f "$JAR"
LOGIN=$(curl -s -c "$JAR" -X POST "$BASE/api/auth/login" -H "Content-Type: application/json" -d '{"nationalId":"1000000011","password":"demo1234"}')
echo "$LOGIN" | grep -q '"ok":true' && ok "login SUPER_ADMIN" || bad "login SUPER_ADMIN: $LOGIN"

SCHOOL_ID="cmu31j2c00007vv86k2vwdmtw"

echo "── ۲) ورود به پنل مدرسه (acting school)"
ENTER=$(curl -s -b "$JAR" -c "$JAR" -X POST "$BASE/api/schools/$SCHOOL_ID/enter" -H "Content-Type: application/json" -d '{}')
echo "$ENTER" | grep -q '"ok":true' && ok "enter school panel" || bad "enter school panel: $ENTER"

echo "── ۳) مسیرهایی که قبلاً برای سوپرادمین می‌شکستند (requireSchoolId)"
# students list (school-scoped)
R1=$(curl -s -b "$JAR" "$BASE/api/students" -w "\n%{http_code}")
C1=$(echo "$R1" | tail -1)
[ "$C1" = "200" ] && ok "GET /api/students → 200" || bad "GET /api/students → $C1: $(echo "$R1" | head -c 200)"
# classes list
R2=$(curl -s -b "$JAR" "$BASE/api/classes" -w "\n%{http_code}")
C2=$(echo "$R2" | tail -1)
[ "$C2" = "200" ] && ok "GET /api/classes → 200" || bad "GET /api/classes → $C2"
# events
R3=$(curl -s -b "$JAR" "$BASE/api/events" -w "\n%{http_code}")
C3=$(echo "$R3" | tail -1)
[ "$C3" = "200" ] && ok "GET /api/events → 200" || bad "GET /api/events → $C3"
# announcements
R4=$(curl -s -b "$JAR" "$BASE/api/announcements" -w "\n%{http_code}")
C4=$(echo "$R4" | tail -1)
[ "$C4" = "200" ] && ok "GET /api/announcements → 200" || bad "GET /api/announcements → $C4"
# badges (راند ۱۸: تعریف فقط سوپرادمین)
R5=$(curl -s -b "$JAR" "$BASE/api/badges" -w "\n%{http_code}")
C5=$(echo "$R5" | tail -1)
[ "$C5" = "200" ] && ok "GET /api/badges → 200" || bad "GET /api/badges → $C5: $(echo "$R5" | head -c 200)"
# engagement
R6=$(curl -s -b "$JAR" "$BASE/api/engagement" -w "\n%{http_code}")
C6=$(echo "$R6" | tail -1)
[ "$C6" = "200" ] && ok "GET /api/engagement → 200" || bad "GET /api/engagement → $C6"
# dashboard (مهم‌ترین — داشبورد مدرسه)
R7=$(curl -s -b "$JAR" "$BASE/api/dashboard" -w "\n%{http_code}")
C7=$(echo "$R7" | tail -1)
[ "$C7" = "200" ] && ok "GET /api/dashboard → 200" || bad "GET /api/dashboard → $C7: $(echo "$R7" | head -c 300)"
# search (جستجوی سراسری با acting scope — کوئری فارسی URL-encoded)
R8=$(curl -s -b "$JAR" "$BASE/api/search?q=%D8%A8%D9%87%D8%A7%D8%B1" -w "\n%{http_code}")
C8=$(echo "$R8" | tail -1)
[ "$C8" = "200" ] && ok "GET /api/search → 200" || bad "GET /api/search → $C8"

echo "── ۴) خروج از پنل مدرسه"
EXIT=$(curl -s -b "$JAR" -c "$JAR" -X POST "$BASE/api/schools/$SCHOOL_ID/enter" -H "Content-Type: application/json" -d '{"exit":true}')
echo "$EXIT" | grep -q '"ok":true' && ok "exit school panel" || bad "exit school panel: $EXIT"

echo "── ۵) کپچا: ساخت چالش + پاسخ غلط"
CH=$(curl -s "$BASE/api/captcha")
TOKEN=$(echo "$CH" | bun -e "const d=await Bun.stdin.json();console.log(d.token)" 2>/dev/null)
if [ -z "$TOKEN" ]; then TOKEN=$(echo "$CH" | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])" 2>/dev/null); fi
[ -n "$TOKEN" ] && ok "GET /api/captcha → token" || bad "captcha token empty"
# پاسخ غلط → بعد از ۲ شکستِ «کاربر فرضی»، کپچا لازم می‌شود
JAR2="/tmp/r19-captcha.txt"; rm -f "$JAR2"
for i in 1 2 3; do
  curl -s -c "$JAR2" -X POST "$BASE/api/auth/login" -H "Content-Type: application/json" \
    -d '{"nationalId":"1234567891","password":"wrongpass"}' > /tmp/r19-fail.json
done
grep -o '"captchaRequired":true' /tmp/r19-fail.json | head -1 | grep -q true && ok "3 شکست IP → captchaRequired" || bad "captchaRequired not set after 3 IP fails: $(cat /tmp/r19-fail.json | head -c 200)"
# با کپچای غلط → CAPTCHA_REQUIRED
R=$(curl -s -b "$JAR2" -X POST "$BASE/api/auth/login" -H "Content-Type: application/json" \
  -d "{\"nationalId\":\"1234567891\",\"password\":\"wrongpass\",\"captchaToken\":\"$TOKEN\",\"captchaAnswer\":\"۰۰۰۰۰\"}")
echo "$R" | grep -q 'CAPTCHA_REQUIRED' && ok "کپچای غلط → CAPTCHA_REQUIRED" || bad "wrong captcha accepted? $R"

echo "── ۶) تلگرام: setup status + وب‌هوک بدون احراز"
TG=$(curl -s -b "$JAR" "$BASE/api/telegram/setup")
echo "$TG" | grep -q '"configured":false' && ok "GET /api/telegram/setup → configured:false (بدون توکن)" || bad "telegram setup: $(echo "$TG" | head -c 200)"
WH=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/telegram/webhook" -H "Content-Type: application/json" -d '{"update_id":1}')
[ "$WH" = "200" ] && ok "POST /api/telegram/webhook (ربات خاموش) → 200" || bad "webhook → $WH"
WHG=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/telegram/webhook")
[ "$WHG" = "200" ] && ok "GET /api/telegram/webhook (سلامت) → 200" || bad "webhook GET → $WHG"

echo "── ۷) صفحه لاگین/داشبورد رندر می‌شوند"
for p in "/" "/login" "/plans"; do
  C=$(curl -s -o /dev/null -w "%{http_code}" "$BASE$p")
  [ "$C" = "200" ] && ok "GET $p → 200" || bad "GET $p → $C"
done
DASH=$(curl -s -b "$JAR" -o /dev/null -w "%{http_code}" "$BASE/app")
[ "$DASH" = "200" ] && ok "GET /app (داشبورد) → 200" || bad "GET /app → $DASH"

echo ""
echo "════════ نتیجه: $PASS ✓ / $FAIL ✗ ════════"
[ "$FAIL" = "0" ]
