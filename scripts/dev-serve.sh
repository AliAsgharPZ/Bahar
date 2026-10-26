#!/usr/bin/env bash
# بهار | راه‌اندازی دائمی سرور dev به‌صورت دیمن
# مشکل: پروسه‌های فرزندِ فرمان‌های ابزار، با پایان فرمان کشته می‌شوند.
# راه‌حل: setsid --fork → فرزند بلافاصله به PID 1 (tini) سپرده می‌شود و
# از درخت پروسه‌ی شلِ ابزار خارج می‌گردد؛ پاک‌سازِ پس از فرمان دیگر آن را نمی‌بیند.
# NODE_OPTIONS: کپ heap تا OOM killer کل کانتینر را نکشد (رم کل: ۳.۹GB).

cd "$(dirname "$0")/.."

# اگر سرور زنده است، کاری نکن
if curl -s -o /dev/null --connect-timeout 2 http://127.0.0.1:3000/; then
  echo "dev server already running — nothing to do"
  exit 0
fi

# پروسه‌های نیمه‌مُده را پاک کن (اگر هست)
pkill -f 'next dev -p 3000' 2>/dev/null
pkill -f 'next-server' 2>/dev/null
sleep 1

rm -f dev.log
# راند ۱۸: اگر سندباکس .env را ریست کرده باشد، کلید پایدار db/ را بازیابی کن
if ! grep -Eq '^SESSION_SECRET=' .env 2>/dev/null || [ -z "$(grep -E '^SESSION_SECRET=' .env | cut -d= -f2-)" ]; then
  if [ -s db/session-secret.txt ]; then
    echo "SESSION_SECRET=$(cat db/session-secret.txt)" >> .env
    echo "🔑 SESSION_SECRET از پشتیبان پایدار db/ بازیابی شد."
  else
    openssl rand -hex 32 | sed 's/^/SESSION_SECRET=/' >> .env
    grep -E '^SESSION_SECRET=' .env | cut -d= -f2- > db/session-secret.txt
    chmod 600 db/session-secret.txt
    echo "🔑 SESSION_SECRET تازه تولید و در db/ ذخیره شد."
  fi
fi
setsid --fork sh -c 'cd "$(dirname "$0")/.." && NODE_OPTIONS="--max-old-space-size=2048" exec bun run dev' > /dev/null 2>&1

# صبر تا آماده شود (حداکثر ۶۰ ثانیه)
for i in $(seq 1 30); do
  if curl -s -o /dev/null --connect-timeout 2 --max-time 5 http://127.0.0.1:3000/; then
    echo "dev server UP after ${i}x2s"
    exit 0
  fi
  sleep 2
done
echo "ERROR: dev server did not come up in 60s"
exit 1
