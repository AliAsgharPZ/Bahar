# Bahar Android App

The official Android app for **Bahar — School Management System**. It wraps
the full Bahar web app in a native shell and builds to an APK with Android
Studio.

> This project has **no external dependencies** (no androidx / material), so
> the common `Could not find com.google.android.material:material` or
> `androidx.core:core` build errors cannot occur — the build works even
> without access to `dl.google.com`.

---

## 1) Before building — set your server URL

Open:

```
app/src/main/java/ir/bahar/school/MainActivity.java
```

Find this line near the top and replace `bahar.example.com` with your own
server address:

```java
private static final String SERVER_URL = "https://bahar.example.com";
```

Examples:

| Setup | URL |
|---|---|
| Internet server with a domain | `https://bahar.myschool.ir` |
| Server on the school LAN | `http://192.168.1.10:3000` |
| Local dev on the same machine | `http://10.0.2.2:3000` (emulator's localhost) |

> If your server is plain `http` (no SSL), nothing else is needed — cleartext
> traffic is already enabled in the manifest.

## 2) Open the project in Android Studio

1. Install Android Studio (Koala or newer).
2. **File → Open** and select this folder.
3. Wait for Gradle Sync to finish.
4. If prompted to download Gradle, click **OK**.

> If Sync gets stuck downloading the Gradle distribution, set **File →
> Settings → Build Tools → Gradle → Gradle from: 'Wrapper task in build
> file'**, or point `gradle/wrapper/gradle-wrapper.properties` at a cached
> distribution.

## 3) Build the APK

**Quick debug APK:**

- **Build → Build App Bundle(s) / APK(s) → Build APK(s)**
- Click **locate** in the success message; the file is:
  ```
  app/build/outputs/apk/debug/app-debug.apk
  ```
- Install this file on phones (a debug build is fine for school use).

**Signed release:**

- **Build → Generate Signed App Bundle / APK → APK**
- Create (or pick) a keystore and finish the wizard.
- Output: `app/release/app-release.apk`

## 4) Install on a phone

- Copy the APK to the phone (USB or a messenger).
- On the phone: **Settings → Security → allow installs from unknown sources**.
- Tap the file and install.

## Technical specs

| Item | Value |
|---|---|
| Package ID | `ir.bahar.school` |
| Minimum Android | 7.0 (API 24) |
| Target Android | 14 (API 34) |
| Language | Java, no third-party dependencies |
| Gradle | 8.7 — AGP 8.5.2 |
| JDK | 17 (bundled with Android Studio) |

## App features

- The full Bahar system (national-ID login, dashboard, grades, attendance,
  messages, …)
- RTL with Persian fonts (Arad + Vazirmatn), loaded from the server itself
- File uploads from pages (file picker, camera, …)
- Downloads through the Android download manager
- External links (e.g. Shad) open in the browser
- Back button: page history first, then exit with a second press
- "Server unreachable" screen with a retry button
- Page state preserved on rotation
- Bahar icon in all densities + adaptive icon (Android 8+)

## Common build errors

| Error | Cause / fix |
|---|---|
| `Could not find com.google.android.material:material` / `androidx.core:core` | Fixed in this version — the project has no dependencies. If you opened an old copy, make sure the `dependencies` block in `app/build.gradle` is **empty**. |
| `Unsupported class file major version` | Set the project JDK to 17 (Settings → Build Tools → Gradle → Gradle JDK). |
| Stuck downloading Gradle | In the Android Studio terminal: `gradlew --offline assembleDebug` — builds from cache. |
| `ERROR_HOST_LOOKUP` on the phone | `SERVER_URL` is wrong, or the server is not reachable from the internet. |

## FAQ

**Do I need to rebuild the APK after changing SERVER_URL?**
Yes — any code change needs a new build.

**How do I publish on Google Play / local stores?**
Build a signed release and bump `versionCode` in `app/build.gradle` by one.

**Does it have push notifications?**
Bahar notifications reach users through Shad and the built-in messenger. OS
push (FCM) needs Google servers, which are usually unavailable to Iranian
schools.

**Why does the login persist in the app?**
The Bahar session cookie is stored in the WebView and stays until sign-out
or session expiry — same as a browser.
