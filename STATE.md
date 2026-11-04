# Állapot

Frissítve: 2026-11-04. Egy oldal: a `/agentic-code:save-work` írja újra, a `/agentic-code:resume-work` olvassa először.

## Mi ez
Helyi, titkosított személyes pénzügyi app (Expo / React Native). Verzió: 1.3.1 (versionCode 7). A Play-en az 1.3.0 (versionCode 6) van kint, és Android 14+-on betöltéskor összeomlik (B23).

## Most
- **B23 javítva:** az 1.3.0 a `blockedPermissions`-ben tiltotta a `DETECT_SCREEN_CAPTURE`-t, az `expo-screen-capture` pedig induláskor használja; a jogosultság visszakerült, a `tests/appConfig.test.ts` őrzi. Eszközön (Gyula telefonja, Android 16) egy külön csomagnevű release APK-val ellenőrizve: elindul, a feloldóképernyő megjelenik.
- **PR #8** merge-elve (a javítás és a verzió 1.3.1). A versionCode 7 a merge után került az ágra, ezért külön ágon jön (`chore/release-1.3.1-followup`).
- **1.3.1 AAB kész** (helyi EAS build, upload kulccsal aláírva, a manifestben benne a jogosultság); a fájl a munkamenet `/tmp`-s scratchpadjában van, újraindításkor elveszik.
- A PR #7 (stílusátvizsgálás) a `main`-en van.
- Eszközön még nincs kipróbálva: a History lapozás, a jelszócsere, a képernyőkép-tiltás bekapcsolva, a havi export 6. feladata. iOS-ről semmi nincs ellenőrizve.

## Ágak
- `chore/release-1.3.1-followup`: versionCode 7 és jegyzetek; PR még nincs.
- `main`: a PR #1–#8 merge-elve.

## Build (Linux)
- JDK 17: `/opt/dev/jdk17` (`JAVA_HOME`; a rendszer JDK 25-tel a Gradle 9.0 nem fut), Android SDK: `~/Android/Sdk` (NDK 27.0 és 27.1 telepítve), adb: `~/Android/Sdk/platform-tools/adb`.
- **Éles AAB helyben (sor nélkül):** `ANDROID_HOME=~/Android/Sdk JAVA_HOME=/opt/dev/jdk17 npx eas-cli@27 build -p android --profile production --local --non-interactive --output <út>.aab` (~6 perc). Az EAS emeli a versionCode-ot az `app.json`-ban: utána commitolni. Az `expo doctor` `newArchEnabled`-figyelmeztetése nem állítja meg. EAS-belépés: `npx eas-cli@27 login` (böngészős, Google-fiókkal megy).
- **Release teszt-APK a telefonra:** `npx expo prebuild --platform android --no-install`, az `android/app/build.gradle` release blokkjába `applicationIdSuffix ".crashtest"` (különben ütközik az éles appal és az adataival), `android/`-ban `./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a` (~2,5 perc melegen). Az `android/` ignorált; benne most egy NDK-rögzítés van (`build.gradle` vége), a `.crashtest` kivéve.
- Dev build: ugyanígy `assembleDebug`, `applicationIdSuffix ".dev"`, majd `adb reverse tcp:8081 tcp:8081` és `npx expo start --localhost`.

## Blokkol / várunk
- Gyula: az 1.3.1 AAB feltöltése a Play Console-ba; az 1.3.0 rolloutjának leállítása, ha még fut.

## Következő lépés
1. Az 1.3.1 feltöltése; a `chore/release-1.3.1-followup` PR-ja és merge-e (versionCode 7 nélkül a következő EAS build is 7-et kapna).
2. Kis takarítás: az `app.json`-ból a `newArchEnabled` törlése (SDK 55-ben mindig be van kapcsolva, az `expo doctor` hibának jelzi).
3. **Tétel nevének automatikus kiegészítése:** a tranzakcióűrlap Title mezőjében gépelés közben korábbi tételnevek (kezdőbetűk alapján, gyakoriság/utolsó használat szerint), egy koppintással; a kategória és a zseb is ajánlható az utolsó ilyen nevű tételből. `spec` skill-lel kezdd (forrás: `transactions.title`; nincs új függőség, hálózat, naplózás).
4. Havi export: a 6. feladat (eszközön, teszt-vaulttal). README 5. sora kiegészítést kérhet az exportról.
5. B22 (alacsony): a History szűrőchipjén a „×” iOS VoiceOverrel nem érhető el.
6. README „Still to add”: szerkeszthető `occurred_at`, zseb átnevezés UX.

## Súrlódás
- A pre-commit check a teljes munkafát típusellenőrzi, nem csak a stage-elt fájlokat (egyszer, kb. 2 perc).
- Az egymásra épülő PR-ok a saját alap-águkba olvadtak (egyszer). Minden PR a `main`-re menjen.
- Új natív függőség után a dev build elavult volt (egyszer, kb. 15 perc). Új natív függőség után azonnal új dev build.
- Vizuális hibák csak a telefonon derültek ki (egyszer, kb. 10 perc). Vizuális változás után azonnal eszközön nézni.
- Az app-konfiguráció (`blockedPermissions`) csak release buildben érvényesül, a dev build nem fogta meg a B23-at; az 1.3.0 összeomlóan ment ki. Kiadás előtt release APK-t kell a telefonon elindítani (fent: „Release teszt-APK”).
- A helyi Android-build első futása kb. 30 percet vitt el: a `~/.jdks/temurin-17` eltűnt (JDK 25-tel a Gradle 9.0 elbukik), az AGP pedig az NDK 27.0 letöltésén 12 percig állt, félkész mappát hagyva. Most mindkettő rendben (fent: Build).
