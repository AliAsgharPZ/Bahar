// ============================================================
// بهار | اپ ویندوز — Electron
// آدرس سرور را در فایل config.json تنظیم کنید
// (کنار exe در پوشه resources — یا کنار main.js در حالت dev)
// ============================================================

const { app, BrowserWindow, Menu, shell, dialog } = require("electron");
const path = require("path");
const fs = require("fs");

// ─── تنظیم سرور ───
const CONFIG_PATH = path.join(process.resourcesPath || __dirname, "config.json");
function loadServerUrl() {
  try {
    const cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
    if (cfg && typeof cfg.serverUrl === "string" && cfg.serverUrl.startsWith("http")) {
      return cfg.serverUrl.replace(/\/+$/, "");
    }
  } catch {
    /* فایل نبود — از پیش‌فرض */
  }
  return "https://bahar.example.com";
}
const SERVER_URL = loadServerUrl();

let win = null;

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 960,
    minHeight: 600,
    backgroundColor: "#ffffff",
    title: "بهار — سامانه مدیریت مدرسه",
    icon: path.join(__dirname, "icon.png"),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
    },
  });

  // منوی فارسی و مینیمال
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: "بهار",
        submenu: [
          { label: "بازخوانی", accelerator: "F5", click: () => win.reload() },
          { label: "بازگشت", accelerator: "Alt+Right", click: () => win.webContents.goBack() },
          { type: "separator" },
          { label: "خروج", accelerator: "Alt+F4", role: "quit" },
        ],
      },
      {
        label: "نمایش",
        submenu: [{ role: "zoomIn" }, { role: "zoomOut" }, { role: "resetZoom" }],
      },
    ])
  );

  // لینک‌های خارجی در مرورگر پیش‌فرض باز شوند
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(SERVER_URL)) {
      shell.openExternal(url);
      return { action: "deny" };
    }
    return { action: "allow" };
  });

  // دانلودها را خودکار در پوشه Downloads ذخیره کن
  win.webContents.session.on("will-download", (_event, item) => {
    const downloadsDir = app.getPath("downloads");
    item.setSavePath(path.join(downloadsDir, item.getFilename()));
  });

  // صفحه خطا (عدم دسترسی به سرور)
  win.webContents.on("did-fail-load", (_e, code, _desc, _url, isMain) => {
    if (isMain && (code === -106 || code === -3 || code === -105 || code === -7)) {
      dialog
        .showMessageBox(win, {
          type: "warning",
          title: "بهار",
          message: "ارتباط با سرور بهار برقرار نشد",
          detail: "اتصال اینترنت یا آدرس سرور را بررسی کنید و دوباره تلاش کنید.",
          buttons: ["تلاش مجدد", "بستن"],
          defaultId: 0,
          cancelId: 1,
        })
        .then((r) => {
          if (r.response === 0) win.loadURL(SERVER_URL);
        });
    }
  });

  win.loadURL(SERVER_URL);
}

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
