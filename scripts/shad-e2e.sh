#!/usr/bin/env bash
# ============================================================
# بهار | E2E شاد (راند ۱۹-a) — کل جریان دروازه شاد با HTTP واقعی
# اجرا: bash scripts/shad-e2e.sh   (سرور dev باید روی :3000 بالا باشد)
# جریان‌ها:
#   ۰) ورود مدیر دمو + سوپرادمین + پاکسازی بقایای اجرای قبلی
#   ۱) مدیر دمو: قطع → کد تایید (غلط/درست) → اتصال INTERNAL
#   ۲) ارسال گروهی اعتبارنامه‌ها + جاروی صف (sweep)
#   ۳) سوپرادمین در پنل مدرسه: گزارش صف (باگ راند ۱۹-a)
#   ۴) ساخت کاربر با/بدون شماره شاد → SENT / NO_SHAD_NUMBER
#   ۵) خاموش/روشن کردن ماژول شاد مدرسه → 403 SHAD_DISABLED → SKIPPED
#   ۶) اطلاع کوتاه + قطع اتصال + اتصال مجدد (حالت نهایی: متصل)
#   ۷) پاکسازی داده تست (حذف کامل)
# ============================================================
set -u
BASE="http://localhost:3000"
JAR_M="/tmp/shad-e2e-manager.jar"
JAR_S="/tmp/shad-e2e-super.jar"
SCHOOL_ID="${SCHOOL_ID:-cmu31j2c00007vv86k2vwdmtw}"
MGR_NID="2000000010"; MGR_PASS="demo1234"
SUP_NID="1000000011"; SUP_PASS="demo1234"
MGR_SHAD="09120000010"
TEACHER_SHAD="09120000101"
T1_NID="7100000051"   # کاربر تست ۱ (با شاد)
T2_NID="7100000068"   # کاربر تست ۲ (بدون شاد)
T3_NID="7100000084"   # کاربر تست ۳ (ساخت در حالت خاموش)
T1_ID=""; T2_ID=""; T3_ID=""
TMP="/tmp/shad-e2e"
PASS=0; FAIL=0

ok()   { PASS=$((PASS+1)); echo "  ✔ $1"; }
bad()  { FAIL=$((FAIL+1)); echo "  ✘ $1"; }
check() { # check <desc> <json-file> <python-expr on d>
  local desc="$1" file="$2" expr="$3"
  local err
  err=$(python3 -c "import json; d=json.load(open('$file')); $expr" 2>&1) && { ok "$desc"; return; }
  bad "$desc"
  echo "      ↳ $(echo "$err" | tail -1 | head -c 200)"
}
jq_get() { python3 -c "import sys,json;d=json.load(sys.stdin);print($1)"; }

reqf() { # reqf <jar> <method> <path> <outfile> [json-body] → پاسخ در فایل
  local jar="$1" method="$2" path="$3" out="$4" body="${5:-}"
  if [ -n "$body" ]; then
    curl -s -b "$jar" -c "$jar" -X "$method" "$BASE$path" -H 'content-type: application/json' -d "$body" -o "$out"
  else
    curl -s -b "$jar" -c "$jar" -X "$method" "$BASE$path" -o "$out"
  fi
}
req() { # req <jar> <method> <path> [json-body] → پاسخ در خروجی
  local jar="$1" method="$2" path="$3" body="${4:-}"
  if [ -n "$body" ]; then
    curl -s -b "$jar" -c "$jar" -X "$method" "$BASE$path" -H 'content-type: application/json' -d "$body"
  else
    curl -s -b "$jar" -c "$jar" -X "$method" "$BASE$path"
  fi
}
code_of() { python3 -c "import json;d=json.load(open('$1'));print(d.get('error',{}).get('code') or d.get('code') or '')" 2>/dev/null; }

mkdir -p "$TMP"

echo "── ۰) ورود + پاکسازی بقایای اجرای قبلی ──"
rm -f "$JAR_M" "$JAR_S"
req "$JAR_M" POST /api/auth/login "{\"nationalId\":\"$MGR_NID\",\"password\":\"$MGR_PASS\"}" > "$TMP/login-m.json"
check "ورود مدیر دمو" "$TMP/login-m.json" "exit(0 if d.get('ok') else 1)"
req "$JAR_S" POST /api/auth/login "{\"nationalId\":\"$SUP_NID\",\"password\":\"$SUP_PASS\"}" > "$TMP/login-s.json"
check "ورود سوپرادمین" "$TMP/login-s.json" "exit(0 if d.get('ok') else 1)"
# کاربران تست قبلی (فعال یا غیرفعالِ اجرای قبل) حذف کامل شوند تا DUPLICATE نگیریم
req "$JAR_S" POST "/api/schools/$SCHOOL_ID/enter" '{}' >/dev/null
req "$JAR_S" GET "/api/users?q=%D8%AA%D8%B3%D8%AA&schoolId=$SCHOOL_ID&includeInactive=1" > "$TMP/prev-users.json"
for TID in $(python3 -c "import json; d=json.load(open('$TMP/prev-users.json')); print(' '.join(u['id'] for u in d.get('users',[]) if u.get('firstName')=='تست'))" 2>/dev/null); do
  req "$JAR_S" DELETE "/api/users/$TID?mode=hard" >/dev/null && echo "  پاکسازی کاربر تست قبلی $TID"
done

echo "── ۱) قطع اتصال قبلی → کد تایید → ورود ──"
req "$JAR_M" POST /api/shad/revoke '{}' >/dev/null
req "$JAR_M" GET /api/shad/status > "$TMP/st0.json"
check "وضعیت پس از قطع: متصل نیست" "$TMP/st0.json" "exit(0 if d['connected']==False and d['shadEnabled']==True else 1)"

req "$JAR_M" POST /api/shad/send-code "{\"phone\":\"$MGR_SHAD\"}" > "$TMP/code1.json"
CODE=$(jq_get "d['code']" < "$TMP/code1.json")
check "دریافت کد تایید ۵ رقمی" "$TMP/code1.json" "exit(0 if len(str(d['code']))==5 and str(d['code']).isdigit() else 1)"

req "$JAR_M" POST /api/shad/sign-in "{\"phone\":\"$MGR_SHAD\",\"code\":\"00000\"}" > "$TMP/sign-bad.json"
check "کد غلط رد می‌شود (PHONE_CODE_INVALID)" "$TMP/sign-bad.json" "exit(0 if d['error']['code']=='PHONE_CODE_INVALID' else 1)"

req "$JAR_M" POST /api/shad/sign-in "{\"phone\":\"$MGR_SHAD\",\"code\":\"$CODE\"}" > "$TMP/sign-ok.json"
check "کد درست → اتصال" "$TMP/sign-ok.json" "exit(0 if d.get('ok') else 1)"

req "$JAR_M" GET /api/shad/status > "$TMP/st1.json"
check "وضعیت: AUTHORIZED داخلی" "$TMP/st1.json" "exit(0 if d['connected'] and d['mode']=='INTERNAL' and d['status']=='AUTHORIZED' else 1)"

echo "── ۲) ارسال گروهی + جاروی صف ──"
req "$JAR_M" POST /api/shad/deliver '{"allPending":true}' > "$TMP/deliver.json"
check "ارسال گروهی بدون خطا (results + sweep)" "$TMP/deliver.json" "exit(0 if 'results' in d and 'sweep' in d else 1)"

echo "── ۳) سوپرادمین داخل پنل مدرسه (باگ گزارش خالی) ──"
req "$JAR_S" POST "/api/schools/$SCHOOL_ID/enter" '{}' >/dev/null
req "$JAR_S" GET /api/shad/outbox > "$TMP/outbox-s.json"
check "صف مدرسهٔ فعال دیده می‌شود (غیرخالی)" "$TMP/outbox-s.json" "exit(0 if len(d['outbox'])>0 else 1)"
req "$JAR_S" GET /api/shad/status > "$TMP/st-s.json"
check "وضعیت مدرسهٔ فعال برای سوپرادمین" "$TMP/st-s.json" "exit(0 if d['connected'] and d['mode']=='INTERNAL' else 1)"

echo "── ۴) ساخت کاربر با/بدون شماره شاد ──"
req "$JAR_S" POST /api/users "{\"firstName\":\"تست\",\"lastName\":\"شاد یک\",\"role\":\"TEACHER\",\"nationalId\":\"$T1_NID\",\"shadNumber\":\"09121112244\"}" > "$TMP/u1.json"
check "کاربر با شاد → اعتبارنامه SENT" "$TMP/u1.json" "exit(0 if d.get('shadDelivery',{}).get('ok') and d['shadDelivery']['status']=='SENT' else 1)"
T1_ID=$(jq_get "d['user']['id']" < "$TMP/u1.json" 2>/dev/null || true)
req "$JAR_S" POST /api/users "{\"firstName\":\"تست\",\"lastName\":\"شاد دو\",\"role\":\"TEACHER\",\"nationalId\":\"$T2_NID\"}" > "$TMP/u2.json"
check "کاربر بدون شاد → NO_SHAD_NUMBER" "$TMP/u2.json" "exit(0 if d.get('shadDelivery',{}).get('ok')==False and d['shadDelivery'].get('error')=='NO_SHAD_NUMBER' else 1)"
T2_ID=$(jq_get "d['user']['id']" < "$TMP/u2.json" 2>/dev/null || true)

echo "── ۵) خاموش/روشن کردن ماژول شاد مدرسه ──"
req "$JAR_S" PATCH "/api/schools/$SCHOOL_ID" '{"shadEnabled":false}' >/dev/null
req "$JAR_M" GET /api/shad/status > "$TMP/st-off.json"
check "وضعیت shadEnabled=false گزارش می‌شود" "$TMP/st-off.json" "exit(0 if d['shadEnabled']==False else 1)"
req "$JAR_M" POST /api/shad/send-code "{\"phone\":\"$MGR_SHAD\"}" > "$TMP/code-off.json"
check "کد تایید در حالت خاموش → 403 SHAD_DISABLED" "$TMP/code-off.json" "exit(0 if d['error']['code']=='SHAD_DISABLED' else 1)"
req "$JAR_M" POST /api/shad/deliver '{"allPending":true}' > "$TMP/deliver-off.json"
check "ارسال گروهی در حالت خاموش → 403 SHAD_DISABLED" "$TMP/deliver-off.json" "exit(0 if d['error']['code']=='SHAD_DISABLED' else 1)"
req "$JAR_S" POST /api/users "{\"firstName\":\"تست\",\"lastName\":\"شاد سه\",\"role\":\"TEACHER\",\"nationalId\":\"$T3_NID\",\"shadNumber\":\"09121112255\"}" > "$TMP/u3.json"
check "ساخت کاربر در حالت خاموش → SKIPPED (کارت کپی)" "$TMP/u3.json" "exit(0 if d.get('shadDelivery',{}).get('status')=='SKIPPED' and d['shadDelivery'].get('error')=='SHAD_DISABLED' else 1)"
T3_ID=$(jq_get "d['user']['id']" < "$TMP/u3.json" 2>/dev/null || true)
req "$JAR_S" PATCH "/api/schools/$SCHOOL_ID" '{"shadEnabled":true}' >/dev/null
req "$JAR_M" GET /api/shad/status > "$TMP/st-on.json"
check "روشن کردن مجدد → نشست حفظ شد" "$TMP/st-on.json" "exit(0 if d['shadEnabled'] and d['connected'] and d['mode']=='INTERNAL' else 1)"

echo "── ۶) اطلاع کوتاه + قطع + اتصال مجدد ──"
req "$JAR_M" POST /api/shad/notice "{\"to\":\"$TEACHER_SHAD\",\"text\":\"تست اطلاع کوتاه شاد (19-a)\"}" > "$TMP/notice.json"
check "ارسال اطلاع کوتاه" "$TMP/notice.json" "exit(0 if d.get('ok') else 1)"

req "$JAR_M" POST /api/shad/revoke '{}' >/dev/null
req "$JAR_M" GET /api/shad/status > "$TMP/st-rev.json"
check "قطع اتصال → REVOKED" "$TMP/st-rev.json" "exit(0 if d['connected']==False and d['status']=='REVOKED' else 1)"

req "$JAR_M" POST /api/shad/send-code "{\"phone\":\"$MGR_SHAD\"}" > "$TMP/code2.json"
CODE=$(jq_get "d['code']" < "$TMP/code2.json")
req "$JAR_M" POST /api/shad/sign-in "{\"phone\":\"$MGR_SHAD\",\"code\":\"$CODE\"}" > "$TMP/sign2.json"
req "$JAR_M" GET /api/shad/status > "$TMP/st2.json"
check "اتصال مجدد → حالت نهایی متصل" "$TMP/st2.json" "exit(0 if d['connected'] and d['mode']=='INTERNAL' else 1)"

echo "── ۷) پاکسازی داده تست (حذف کامل) ──"
for TID in "$T1_ID" "$T2_ID" "$T3_ID"; do
  if [ -n "$TID" ] && [ "$TID" != "None" ]; then
    req "$JAR_S" DELETE "/api/users/$TID?mode=hard" >/dev/null && echo "  حذف کامل کاربر تست $TID"
  fi
done
req "$JAR_S" GET "/api/shad/outbox?schoolId=$SCHOOL_ID" > "$TMP/outbox-final.json"
echo "  صف نهایی: $(jq_get "len(d['outbox'])" < "$TMP/outbox-final.json") پیام (نمایش حداکثر ۲۰۰)"

echo "══════════════════════════════════"
echo "نتیجه: $PASS موفق · $FAIL ناموفق"
[ "$FAIL" -eq 0 ] && echo "همه جریان‌های شاد سبز است ✅" || exit 1
