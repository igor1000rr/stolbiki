## Google Play — подпись APK/AAB

### 1. Генерация keystore (один раз, на маке)
```bash
cd ~/stolbiki/android
keytool -genkey -v -keystore snatch-release.jks -keyalg RSA -keysize 2048 -validity 10000 -alias snatch
```
Запомни пароль! Keystore НЕ коммитится в git.

### 2. Создай keystore.properties
```bash
cat > keystore.properties << EOF
storeFile=snatch-release.jks
storePassword=ТВОЙ_ПАРОЛЬ
keyAlias=snatch
keyPassword=ТВОЙ_ПАРОЛЬ
EOF
```

### 3. Собери Release AAB (для Google Play)
```bash
cd ~/stolbiki && npm run build && npx cap sync
cd android && ./gradlew bundleRelease
```
AAB: `android/app/build/outputs/bundle/release/app-release.aab`

### 4. Или Release APK (для тестирования)
```bash
./gradlew assembleRelease
```
APK: `android/app/build/outputs/apk/release/app-release.apk`
