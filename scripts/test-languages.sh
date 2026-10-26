#!/bin/bash
# تست E2E سیستم زبان کاستوم: اعتبارسنجی → آپلود → فعال‌سازی → دریافت بسته → انتخاب کاربر → حذف
set -e
BASE="http://localhost:3000"
COOKIE="/tmp/cookie-SUPER_ADMIN.txt"

# ۱) ساخت بسته انگلیسی نمونه
cat > /tmp/en-pack.json << 'EOF'
{
  "code": "en",
  "name": "انگلیسی",
  "nativeName": "English",
  "direction": "ltr",
  "author": "Bahar Test",
  "version": "1.0.0",
  "notes": "Test English pack",
  "strings": {
    "shell.dashboard": "Dashboard",
    "shell.home": "Home",
    "shell.logout": "Log out",
    "shell.profile": "Profile",
    "shell.settings": "Settings",
    "shell.language": "Language",
    "nav.schools": "Schools",
    "nav.users": "Users",
    "nav.students": "Students",
    "nav.classes": "Classes",
    "nav.grades": "Grades",
    "nav.attendance": "Attendance",
    "nav.schedule": "Timetable",
    "nav.assignments": "Assignments",
    "nav.messages": "Messages",
    "nav.settings": "System Settings",
    "common.save": "Save",
    "common.cancel": "Cancel",
    "common.delete": "Delete",
    "common.edit": "Edit",
    "common.search": "Search",
    "common.loading": "Loading…",
    "common.empty": "No records yet",
    "auth.login.title": "Sign in to Bahar",
    "auth.login.username": "National ID (username)",
    "auth.login.password": "Password",
    "auth.login.submit": "Sign in",
    "auth.login.hint": "Every user's username is their National ID; passwords are randomly generated and delivered via Shad",
    "dashboard.title": "Dashboard",
    "dashboard.todayAbsents": "Today's Absents"
  }
}
EOF

echo "=== 1) dry-run validate ==="
curl -s -X POST "$BASE/api/languages?validate=1" -b $COOKIE -H "Content-Type: application/json" -d @/tmp/en-pack.json | head -c 400; echo

echo "=== 2) upload pack ==="
curl -s -X POST "$BASE/api/languages" -b $COOKIE -H "Content-Type: application/json" -d @/tmp/en-pack.json | head -c 300; echo

echo "=== 3) list packs ==="
curl -s "$BASE/api/languages" -b $COOKIE | head -c 400; echo

PACK_ID=$(curl -s "$BASE/api/languages" -b $COOKIE | python3 -c "import json,sys; d=json.load(sys.stdin); print([p['id'] for p in d['packs'] if p['code']=='en'][0])")
echo "PACK_ID=$PACK_ID"

echo "=== 4) activate pack ==="
curl -s -X PATCH "$BASE/api/languages/$PACK_ID" -b $COOKIE -H "Content-Type: application/json" -d '{"status":"ACTIVE"}' | head -c 200; echo

echo "=== 5) get public pack ==="
curl -s "$BASE/api/languages/pack?code=en" | python3 -c "import json,sys; d=json.load(sys.stdin); print('code:',d['code'],'dir:',d['direction'],'keys:',len(d['strings']),'dashboard:',d['strings'].get('shell.dashboard'))"

echo "=== 6) set my language (manager cookie) ==="
curl -s -X PATCH "$BASE/api/languages/en" -b /tmp/cookie-MANAGER.txt -H "Content-Type: application/json" -d '{"action":"set-my-language"}' | head -c 200; echo

echo "=== 7) me returns langCode ==="
curl -s "$BASE/api/auth/me" -b /tmp/cookie-MANAGER.txt | python3 -c "import json,sys; d=json.load(sys.stdin); print('langCode:', d['user'].get('langCode'))"

echo "=== 8) invalid pack rejected ==="
curl -s -X POST "$BASE/api/languages" -b $COOKIE -H "Content-Type: application/json" -d '{"code":"x@!","name":"x","nativeName":"x","direction":"diag","strings":{"shell.dashboard":"<script>alert(1)</script>"}}' | head -c 400; echo

echo "=== 9) non-superadmin cannot upload ==="
curl -s -o /dev/null -w "%{http_code}\n" -X POST "$BASE/api/languages" -b /tmp/cookie-MANAGER.txt -H "Content-Type: application/json" -d @/tmp/en-pack.json

echo "=== 10) unauthenticated list blocked ==="
curl -s -o /dev/null -w "%{http_code}\n" "$BASE/api/languages"
