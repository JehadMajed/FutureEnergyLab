# Lamp Panel — Android app

An Android app (APK) for the Lamp Panel Digital Twin. It opens the phone interface of the
site, <https://digital-twin-lamps-panel.pages.dev/app/> (source: `../app/`), full screen, so
**every update to that page reaches the app without a new APK**. A new APK is only needed
when the app shell itself changes.

The phone interface has four sections in a bottom bar: **Live** (power ring, lamp state,
voltage, current, power factor, NB2 breaker, session trend, this month), **Field data** (the
weekly uploads from the lab PC, per month or all months), **Simulate** (the dashboard's
40-lamp physics model on a tappable lamp board: scenarios, voltage and temperature, faults,
ageing chart, L70/B10 forecast, energy cost) and **Control** (live camera, 3D twin,
Unlock / Open / Close with confirmation). *About* sits behind the info button. It uses the same identity as the dashboard: teal #006C6B, Inter, the PSAU logo.

What the app shell adds around the page:

| Feature | Detail |
|---|---|
| Splash screen | Brand colour and bulb icon until the page has drawn (at most 4 s) |
| Pull to refresh | Only from the top of the page, never while touching the 3D model, a chart, the camera or a slider |
| Offline screen | Shown when there is no internet; retries when Android confirms the network works, and every 10 s |
| Launcher shortcuts | Long-press the icon: *Live*, *Control*, *Field data*, *Simulate* |
| Back button | Back through the sections to *Live*, then out of the app |
| Haptics | A short tap on navigation and commands |
| Full-screen video | The camera's full-screen mode hides the system bars |
| External links | Open in a Chrome Custom Tab |
| Battery | Page timers pause while the app is in the background |
| Icon | Adaptive icon, with a monochrome version for Android 13+ themed icons |

Android 8.0 (API 26) or newer. Needs internet, like the site.

## Build

Requirements: JDK 21, Android SDK (platform 35, build-tools 35.0.0), Gradle 8.11.1 (downloaded by the wrapper).

```powershell
cd "Digital Twin\android"
.\gradlew assembleRelease
# APK: %TEMP%\lamppanel-build\app\outputs\apk\release\app-release.apk
# (built outside this folder: OneDrive locks build files while it syncs them)
```

The release build is minified (R8) and signed with the key named in `keystore.properties`.

## Signing key

`keystore.properties` and `keystore/*.jks` are **not in Git** (see `.gitignore`); this repository
is public. They stay in this folder on the developer's OneDrive, which is their backup.

Keep the key: Android only installs an update over an existing app if it is signed with the
same key. If the key is lost, uninstall the old app before installing a new build.

`keystore.properties`:

```properties
storeFile=../keystore/lamppanel-release.jks
storePassword=...
keyAlias=lamppanel
keyPassword=...
```

## Release a new version

1. Raise `versionCode` (and `versionName`) in `app/build.gradle.kts`.
2. `.\gradlew assembleRelease`.
3. Install the new APK over the old one.
