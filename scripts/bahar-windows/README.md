# Bahar for Windows — Complete Guide

The Windows edition of **Bahar — School Management System**, built with
Electron: a standalone window that behaves like a real Windows application
and shows the whole Bahar system — national-ID login, dashboard, grades,
monthly report cards, messages and every other section.

Final outputs:

- **Bahar.exe (Portable)** — a single file, no installation; runs on any
  Windows 7/10/11 machine.
- **NSIS installer** — full setup with desktop and Start-menu shortcuts.

---

## 1) Prerequisites (one time)

1. **Node.js 18 or newer** — install the LTS from `nodejs.org`.
2. An internet connection to download the Electron packages (once, ~120 MB).

Check the installation in CMD:

```
node -v
npm -v
```

## 2) Set the server URL (the important step)

Open `config.json` in Notepad and put in your Bahar server address:

```json
{
  "serverUrl": "https://bahar.example.ir"
}
```

| Setup | URL |
|---|---|
| Internet server with a domain | `https://bahar.myschool.ir` |
| Server on the school LAN | `http://192.168.1.10:3000` |
| Local dev on the same machine | `http://localhost:3000` |

> After installing, the same file exists in the `resources` folder next to
> the installed app; if the server ever moves, just edit that file — no
> rebuild needed.

## 3) Try it before building

In CMD, inside this folder:

```
npm install
npm start
```

The Bahar window opens. If everything looks right, build the final files.

## 4) Build

```
npm run dist
```

After a few minutes, the `dist` folder contains:

| File | Description |
|---|---|
| `Bahar-Portable-1.0.0.exe` | Single portable file — runs on any Windows PC |
| `Bahar Setup 1.0.0.exe` | Installer with a desktop shortcut |

Installer only? `npm run dist:installer`

## 5) Delivering to the school

- Send the exe file (USB or a messenger).
- On Windows 10/11, SmartScreen may warn on first run: **More info → Run
  anyway** (the file has no Microsoft code-signing certificate).
- If the server address changes after install: edit `resources\config.json`
  in the install folder.

## 6) Alternative without any build — PWA

The Bahar website itself installs on Windows: open it in **Edge or Chrome**
→ click the install icon in the address bar (or menu ⋯ → Apps → Install) →
Bahar installs as a standalone app with its own icon.

## App features

- Standalone window with Bahar title and icon (not a browser tab)
- Persian menu: reload (F5), back (Alt+→), zoom in/out
- Downloads go automatically to the Downloads folder
- External links (e.g. Shad) open in the default browser
- Persian alert with a retry button when the server is unreachable
- The login cookie persists, like a browser

## Common errors

| Error | Fix |
|---|---|
| `'npm' is not recognized` | Node.js is not installed or PATH is not set; reinstall it |
| `npm install` stalls | Enable a proxy/VPN, or `npm config set registry https://registry.npmmirror.com` |
| White window | `config.json` has a wrong address; check the server URL |
| `electron-builder` error | Make sure `npm install` finished, then `npm run dist` again |
