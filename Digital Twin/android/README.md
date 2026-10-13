# Lamp Panel — Android app

An Android app (APK) for the Lamp Panel Digital Twin. It opens the live site,
<https://digital-twin-lamps-panel.pages.dev/>, full screen, so **every site update reaches the
app without a new APK**. A new APK is only needed when the app shell itself changes.

What the app adds around the site:

| Feature | Detail |
|---|---|
| Splash screen | Brand colour and bulb icon until the page has drawn (at most 4 s) |
| Pull to refresh | Only from the top of the page, never while touching the 3D model, a chart, a slider or the camera |
| Offline screen | Shown when there is no internet; reconnects by itself when the network returns |
| Launcher shortcuts | Long-press the icon: *Live data*, *3D model*, *Simulation* |
| Back button | Goes back through the site's tabs to *Data Overview*, then leaves the app |
| Full-screen video | The camera feed's full-screen mode hides the system bars |
| External links | Open in a Chrome Custom Tab; the app itself only shows the site |
| Battery | Page timers pause while the app is in the background |
| Icon | Adaptive icon, with a monochrome version for Android 13+ themed icons |

Android 8.0 (API 26) or newer. Needs internet, like the site.

## Build

Requirements: JDK 21, Android SDK (platform 35, build-tools 35.0.0), Gradle 8.11.1 (downloaded by the wrapper).

```powershell
cd "Digital Twin\android"
.\gradlew assembleRelease
# APK: app\build\outputs\apk\release\app-release.apk
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
