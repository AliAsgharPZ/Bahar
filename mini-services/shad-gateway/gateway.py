# -*- coding: utf-8 -*-
"""
بهار | دروازه شاد (Bahar Shad Gateway)
========================================
سرویس جانبی پایتون که با کتابخانه غیررسمی shad-api
(github.com/HoseanRC/shad-api) به حساب شاد مدیر مدرسه وصل می‌شود
و امکان «ارسال پیام به شماره شاد» را برای اپ Next.js بهار فراهم می‌کند.

اجرا:
    pip3 install shadapi
    python3 gateway.py            (پیش‌فرض پورت 8787)

مسیرها:
    GET  /health   → {ok: true, version}
    POST /verify   {token, phone}            → {ok, guid, name, phone}
    POST /send     {token, phone, first_name, text} → {ok, message_id}

توکن auth حساب شاد مدیر از web.shad.ir (F12 → Network → auth) گرفته می‌شود.
این سرویس فقط روی 127.0.0.1 گوش می‌دهد و باید روی همان سرور بهار اجرا شود.
"""

import asyncio
import logging
import os

from aiohttp import web, ClientSession, ClientTimeout

from shadapi.accounts.methods import Methods
from shadapi.exceptions import (
    NotRegistered,
    InvaildAuth,
    InvalidInput,
    TooRequests,
    Repeated,
    APIException,
)

VERSION = "1.0.0"
PORT = int(os.environ.get("SHAD_GATEWAY_PORT", "8787"))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [shad-gateway] %(levelname)s %(message)s",
)
log = logging.getLogger("shad-gateway")

# مهلت هر فراخوانی شبکه شاد (ثانیه)
NET_TIMEOUT = ClientTimeout(total=40)


FRIENDLY_ERRORS = {
    "NOT_REGISTERED": "توکن شاد معتبر نیست؛ دوباره از web.shad.ir بگیرید.",
    "INVALID_AUTH": "توکن شاد نامعتبر یا منقضی شده است.",
    "TOO_REQUESTS": "حساب شاد موقتاً محدود شده است؛ کمی بعد دوباره تلاش کنید.",
    "REPEATED": "تعداد درخواست‌ها زیاد است؛ کمی صبر کنید.",
    "INVALID_INPUT": "داده ارسالی به شاد نامعتبر است.",
}


def err_payload(exc) -> dict:
    if isinstance(exc, NotRegistered):
        key = "NOT_REGISTERED"
    elif isinstance(exc, InvaildAuth):
        key = "INVALID_AUTH"
    elif isinstance(exc, TooRequests):
        key = "TOO_REQUESTS"
    elif isinstance(exc, Repeated):
        key = "REPEATED"
    elif isinstance(exc, InvalidInput):
        key = "INVALID_INPUT"
    else:
        key = type(exc).__name__.upper()
    return {"ok": False, "code": key, "error": FRIENDLY_ERRORS.get(key, str(exc) or key)}


def extract_user_from_addressbook(resp: dict):
    """استخراج user_guid از پاسخ addAddressBook (پشتیبانی از فرمت‌های مختلف)."""
    if not isinstance(resp, dict):
        return None
    data = resp.get("data") or {}
    for key in ("new_contacts", "in_contacts"):
        contacts = data.get(key)
        if isinstance(contacts, list):
            for c in contacts:
                if not isinstance(c, dict):
                    continue
                user = c.get("user") if isinstance(c.get("user"), dict) else c
                guid = user.get("user_guid")
                if guid:
                    return {
                        "guid": guid,
                        "first_name": user.get("first_name") or "",
                        "last_name": user.get("last_name") or "",
                        "phone": user.get("phone") or "",
                    }
    return None


async def shad_call(method_coro):
    """اجرای فراخوانی shadapi با مهلت و مدیریت خطا."""
    return await asyncio.wait_for(method_coro, timeout=45)


async def resolve_phone(methods: Methods, phone: str, first_name: str):
    """تبدیل شماره موبایل به user_guid شاد از طریق دفترچه مخاطبین."""
    resp = await shad_call(methods.addAddressBook(phone=phone, first_name=first_name or "بهار"))
    info = extract_user_from_addressbook(resp)
    if not info:
        raise web.HTTPBadRequest(
            text='{"ok": false, "code": "PHONE_NOT_ON_SHAD", "error": "این شماره در پیام‌رسان شاد ثبت نشده است."}',
            content_type="application/json",
        )
    return info


# ---------------- HTTP handlers ----------------

async def health(_request: web.Request) -> web.Response:
    return web.json_response({"ok": True, "version": VERSION})


async def verify(request: web.Request) -> web.Response:
    """اعتبارسنجی توکن مدیر + دریافت اطلاعات حساب (از طریق شماره خودش)."""
    try:
        body = await request.json()
    except Exception:
        return web.json_response({"ok": False, "code": "BAD_REQUEST", "error": "بدنه JSON نامعتبر است."}, status=400)

    token = str(body.get("token") or "").strip()
    phone = str(body.get("phone") or "").strip()
    if len(token) < 20:
        return web.json_response({"ok": False, "code": "BAD_TOKEN", "error": "توکن شاد ارسال نشده یا نامعتبر است."}, status=400)
    if not phone:
        return web.json_response({"ok": False, "code": "BAD_PHONE", "error": "شماره شاد مدیر ارسال نشده است."}, status=400)

    try:
        async with ClientSession(timeout=NET_TIMEOUT) as session:
            methods = Methods(auth=token, session=session, account_guid=None)
            # پیدا کردن حساب مدیر با شماره خودش (همزمان اعتبارسنجی توکن)
            info = await resolve_phone(methods, phone, "بهار")
            # اطلاعات کامل حساب
            try:
                full = await shad_call(methods.getUserInfo(info["guid"]))
                user = ((full or {}).get("data") or {}).get("user") or {}
                name = " ".join(x for x in [user.get("first_name"), user.get("last_name")] if x) or info["first_name"]
                user_phone = user.get("phone") or phone
            except Exception:
                name = info["first_name"]
                user_phone = phone
            return web.json_response({
                "ok": True,
                "guid": info["guid"],
                "name": name,
                "phone": user_phone,
            })
    except web.HTTPBadRequest:
        raise
    except (NotRegistered, InvaildAuth, InvalidInput, TooRequests, Repeated, APIException) as e:
        log.warning("verify failed: %s", e)
        return web.json_response(err_payload(e), status=400)
    except asyncio.TimeoutError:
        return web.json_response({"ok": False, "code": "TIMEOUT", "error": "پاسخی از شبکه شاد دریافت نشد."}, status=504)
    except Exception as e:  # noqa: BLE001
        log.exception("verify crashed")
        return web.json_response({"ok": False, "code": "GATEWAY_ERROR", "error": f"خطای غیرمنتظره دروازه: {e}"}, status=500)


async def send(request: web.Request) -> web.Response:
    """ارسال پیام متنی به شماره شاد کاربر از طریق حساب مدیر."""
    try:
        body = await request.json()
    except Exception:
        return web.json_response({"ok": False, "code": "BAD_REQUEST", "error": "بدنه JSON نامعتبر است."}, status=400)

    token = str(body.get("token") or "").strip()
    phone = str(body.get("phone") or "").strip()
    first_name = str(body.get("first_name") or "بهار").strip()
    text = str(body.get("text") or "").strip()
    if len(token) < 20:
        return web.json_response({"ok": False, "code": "BAD_TOKEN", "error": "توکن شاد ارسال نشده یا نامعتبر است."}, status=400)
    if not phone:
        return web.json_response({"ok": False, "code": "BAD_PHONE", "error": "شماره گیرنده ارسال نشده است."}, status=400)
    if not text:
        return web.json_response({"ok": False, "code": "BAD_TEXT", "error": "متن پیام خالی است."}, status=400)

    try:
        async with ClientSession(timeout=NET_TIMEOUT) as session:
            methods = Methods(auth=token, session=session, account_guid=None)
            # شماره گیرنده → user_guid
            info = await resolve_phone(methods, phone, first_name)
            # ارسال پیام
            resp = await shad_call(methods.sendText(info["guid"], text))
            data = (resp or {}).get("data") or {}
            message_id = data.get("message_id") or data.get("message_id_str") or ""
            return web.json_response({"ok": True, "message_id": str(message_id), "to_guid": info["guid"]})
    except web.HTTPBadRequest:
        raise
    except (NotRegistered, InvaildAuth, InvalidInput, TooRequests, Repeated, APIException) as e:
        log.warning("send failed: %s", e)
        return web.json_response(err_payload(e), status=400)
    except asyncio.TimeoutError:
        return web.json_response({"ok": False, "code": "TIMEOUT", "error": "پاسخی از شبکه شاد دریافت نشد."}, status=504)
    except Exception as e:  # noqa: BLE001
        log.exception("send crashed")
        return web.json_response({"ok": False, "code": "GATEWAY_ERROR", "error": f"خطای غیرمنتظره دروازه: {e}"}, status=500)


def main():
    app = web.Application()
    app.router.add_get("/health", health)
    app.router.add_post("/verify", verify)
    app.router.add_post("/send", send)
    log.info("Bahar Shad Gateway v%s listening on 127.0.0.1:%s", VERSION, PORT)
    web.run_app(app, host="127.0.0.1", port=PORT, print=None)


if __name__ == "__main__":
    main()
