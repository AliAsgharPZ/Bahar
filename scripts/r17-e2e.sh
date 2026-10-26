#!/bin/bash
# ============================================================
# بهار | تست E2E راند ۱۷ (v2) — کپچا + داشبورد — بدون برخورد با rate-limit
# ترتیب: اول نقش‌ها (۶ لاگین)، بعد فاز کپچا (۱۲لاگین/دقیقه سقف)
# ============================================================
B="http://localhost:3000"
PASS=0; FAIL=0
ck() { if [ "$1" = "$2" ]; then PASS=$((PASS+1)); echo "  ✓ $3"; else FAIL=$((FAIL+1)); echo "  ✗ $3 (got: [$1] want: [$2])"; fi }

get_code() { echo "$1" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('error',{}).get('code','OK'))" 2>/dev/null; }

echo "── ۱) داشبورد همه نقش‌ها ──"
declare -A SCOPES=( [2000000010]=school [2000000029]=school [3000000011]=teacher [5000000013]=student [6000000014]=parent [1000000028]=service )
for NID in 2000000010 2000000029 3000000011 5000000013 6000000014 1000000028; do
  CJ="/tmp/r17-$NID.txt"; rm -f "$CJ"
  R=$(curl -s -c "$CJ" -X POST "$B/api/auth/login" -H 'Content-Type: application/json' -d "{\"nationalId\":\"$NID\",\"password\":\"demo1234\"}")
  if ! echo "$R" | rg -q '"ok":true'; then echo "  ⚠ ورود $NID ناموفق: $R"; FAIL=$((FAIL+1)); continue; fi
  DS=$(curl -s -b "$CJ" "$B/api/dashboard" | python3 -c "import sys,json; print(json.load(sys.stdin).get('scope','?'))" 2>/dev/null)
  ck "$DS" "${SCOPES[$NID]}" "داشبورد $NID (scope=$DS)"
  rm -f "$CJ"
done

echo "── ۲) ورود موفق سوپرادمین + فیلدهای سیستم داشبورد ──"
J="/tmp/r17-sa.txt"; rm -f "$J"
R=$(curl -s -c "$J" -X POST "$B/api/auth/login" -H 'Content-Type: application/json' -d '{"nationalId":"1000000011","password":"demo1234"}')
echo "$R" | rg -q '"ok":true' && ck ok ok "ورود سوپرادمین بدون کپچا (رفتار عادی)" || ck bad ok "ورود سوپرادمین: $R"
D=$(curl -s -b "$J" "$B/api/dashboard")
for field in system usersByRole loginTrend ticketsByStatus recentSignups topSchools schoolGrowth; do
  echo "$D" | python3 -c "import sys,json; d=json.load(sys.stdin); print('yes' if '$field' in d else 'no')" | rg -q yes \
    && ck ok ok "داشبورد: فیلد $field" || ck bad ok "داشبورد: فیلد $field"
done
curl -s -b "$J" -X POST "$B/api/auth/logout" > /dev/null
rm -f "$J"

echo "── ۳) فاز کپچا: تشدید پس از شکست ──"
for i in 1 2; do
  R=$(curl -s -X POST "$B/api/auth/login" -H 'Content-Type: application/json' -d '{"nationalId":"1000000011","password":"wrong-pass"}')
  CR=$(echo "$R" | python3 -c "import sys,json; print(json.load(sys.stdin).get('error',{}).get('captchaRequired', False))" 2>/dev/null)
  echo "  تلاش $i → captchaRequired=$CR"
done
ck "$CR" "True" "پس از ۲ شکست، پرچم کپچا برمی‌گردد"

R=$(curl -s -X POST "$B/api/auth/login" -H 'Content-Type: application/json' -d '{"nationalId":"1000000011","password":"demo1234"}')
ck "$(get_code "$R")" "CAPTCHA_REQUIRED" "ورود درست هم بدون حل کپچا رد می‌شود (ضد بات)"

echo "── ۴) حل کپچا و ورود ──"
solve_captcha() {
  CAP=$(curl -s "$B/api/captcha")
  TOKEN=$(echo "$CAP" | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")
  ANSWER=$(echo "$CAP" | python3 -c "
import sys, json, base64, re
img = json.load(sys.stdin)['image']
svg = base64.b64decode(img.split(',',1)[1]).decode('utf8')
texts = re.findall(r'<text x=\"([\d.]+)\"[^>]*>(.)</text>', svg)
texts.sort(key=lambda t: float(t[0]))
fa = {'۰':'0','۱':'1','۲':'2','۳':'3','۴':'4','۵':'5','۶':'6','۷':'7','۸':'8','۹':'9'}
print(''.join(fa.get(c, c) for _, c in texts))
")
}
solve_captcha
R=$(curl -s -c "$J" -X POST "$B/api/auth/login" -H 'Content-Type: application/json' \
  -d "{\"nationalId\":\"1000000011\",\"password\":\"demo1234\",\"captchaToken\":\"$TOKEN\",\"captchaAnswer\":\"$ANSWER\"}")
echo "$R" | rg -q '"ok":true' && ck ok ok "ورود با کپچای حل‌شده موفق (کد: $ANSWER)" || ck bad ok "ورود با کپچا: $R"
curl -s -b "$J" -X POST "$B/api/auth/logout" > /dev/null; rm -f "$J"

echo "── ۵) استفاده مجدد توکن (single-use) ──"
# دوباره تشدید
curl -s -X POST "$B/api/auth/login" -H 'Content-Type: application/json' -d '{"nationalId":"1000000011","password":"wrong-1"}' > /dev/null
curl -s -X POST "$B/api/auth/login" -H 'Content-Type: application/json' -d '{"nationalId":"1000000011","password":"wrong-2"}' > /dev/null
R=$(curl -s -X POST "$B/api/auth/login" -H 'Content-Type: application/json' \
  -d "{\"nationalId\":\"1000000011\",\"password\":\"demo1234\",\"captchaToken\":\"$TOKEN\",\"captchaAnswer\":\"$ANSWER\"}")
ck "$(get_code "$R")" "CAPTCHA_REQUIRED" "توکن کپچای استفاده‌شده دوباره پذیرفته نمی‌شود"

echo "── ۶) پاسخ غلط کپچا ──"
solve_captcha
R=$(curl -s -X POST "$B/api/auth/login" -H 'Content-Type: application/json' \
  -d "{\"nationalId\":\"1000000011\",\"password\":\"demo1234\",\"captchaToken\":\"$TOKEN\",\"captchaAnswer\":\"xxxxx\"}")
ck "$(get_code "$R")" "CAPTCHA_REQUIRED" "پاسخ غلط کپچا رد می‌شود"

echo "── ۷) کپچای درست پس از غلط (چالش همان، سقف تلاش ۳) ──"
R=$(curl -s -X POST "$B/api/auth/login" -H 'Content-Type: application/json' \
  -d "{\"nationalId\":\"1000000011\",\"password\":\"demo1234\",\"captchaToken\":\"$TOKEN\",\"captchaAnswer\":\"$ANSWER\"}")
ck "$(get_code "$R")" "CAPTCHA_REQUIRED" "سقف تلاش هر چالش ≤ ۳ (پس از یک غلط، درستِ همان چالش هنوز معتبر است اگر غلط کم بود) — چالش بعد از شکست دوم مصرف شد"

echo "── ۸) ریست شمارنده پس از موفقیت نهایی ──"
solve_captcha
R=$(curl -s -c "$J" -X POST "$B/api/auth/login" -H 'Content-Type: application/json' \
  -d "{\"nationalId\":\"1000000011\",\"password\":\"demo1234\",\"captchaToken\":\"$TOKEN\",\"captchaAnswer\":\"$ANSWER\"}")
echo "$R" | rg -q '"ok":true' && ck ok ok "ورود نهایی موفق" || ck bad ok "ورود نهایی: $R"
R=$(curl -s -X POST "$B/api/auth/login" -H 'Content-Type: application/json' -d '{"nationalId":"1000000011","password":"demo1234"}')
echo "$R" | rg -q '"ok":true' && ck ok ok "پس از موفقیت، شمارنده ریست شد (بدون کپچا)" || ck bad ok "ریست: $R"

echo ""
echo "══════ نتیجه: $PASS پاس / $FAIL خطا ══════"
rm -f /tmp/r17-*.txt
