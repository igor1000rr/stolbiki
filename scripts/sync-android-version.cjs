#!/usr/bin/env node
/**
 * Синхронизация версии из package.json в android/app/build.gradle.
 *
 * versionName — берётся как есть из package.json ("5.9.20").
 * versionCode — считается из semver: MAJOR*10000 + MINOR*100 + PATCH.
 *   5.9.20  → 50920
 *   5.10.0  → 51000
 *   6.0.0   → 60000
 *
 * Такая схема даёт монотонно растущие versionCode пока MINOR < 100 и
 * PATCH < 100, что для этого проекта заведомо выполняется.
 *
 * Идемпотентно: если в gradle уже нужные значения — ничего не делаем и выходим 0.
 * Падаем только если паттерны versionCode/versionName вообще не найдены
 * (т.е. шаблон сломался — реальная ошибка, не пройдёт).
 *
 * Запуск:
 *   node scripts/sync-android-version.cjs
 */

const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const PKG_PATH = path.join(ROOT, 'package.json')
const GRADLE_PATH = path.join(ROOT, 'android', 'app', 'build.gradle')

function fail(msg) {
  console.error(`[sync-android-version] ❌ ${msg}`)
  process.exit(1)
}

const pkg = JSON.parse(fs.readFileSync(PKG_PATH, 'utf8'))
const versionName = pkg.version
if (!versionName) fail('package.json не содержит version')

const m = versionName.match(/^(\d+)\.(\d+)\.(\d+)/)
if (!m) fail(`version "${versionName}" не semver`)
const [, majorS, minorS, patchS] = m
const major = +majorS, minor = +minorS, patch = +patchS
if (minor > 99 || patch > 99) {
  fail(`minor/patch > 99 в ${versionName} — схема versionCode сломана, нужно пересмотреть`)
}
const versionCode = major * 10000 + minor * 100 + patch

const gradle = fs.readFileSync(GRADLE_PATH, 'utf8')

const codeRe = /versionCode\s+\d+/
const nameRe = /versionName\s+"[^"]+"/

// Валидация шаблонов — падаем только если самого ключевого слова нет в файле.
// Если уже стоят нужные значения — замена не изменит файл, это норма.
if (!codeRe.test(gradle)) fail('не нашёл versionCode в android/app/build.gradle — проверь шаблон')
if (!nameRe.test(gradle)) fail('не нашёл versionName в android/app/build.gradle — проверь шаблон')

const updated = gradle
  .replace(codeRe, `versionCode ${versionCode}`)
  .replace(nameRe, `versionName "${versionName}"`)

if (updated === gradle) {
  console.log(`[sync-android-version] ℹ️  уже ${versionName} (code ${versionCode}) — ничего не меняю`)
  process.exit(0)
}

fs.writeFileSync(GRADLE_PATH, updated)
console.log(`[sync-android-version] ✅ ${versionName} (code ${versionCode}) → android/app/build.gradle`)
