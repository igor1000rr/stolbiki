export default {
  version: '5.9.21',
  date: '2026-04-23',
  title_ru: 'Android release pipeline + security hardening + observability',
  title_en: 'Android release pipeline + security hardening + observability',
  changes_ru: [
    // ─── Android ───
    { type: 'new', text: 'Android: release signing и AAB-workflow для Play Store. Keystore через GitHub Secrets, сборка подписанного AAB по кнопке в Actions.' },
    { type: 'new', text: 'Android: авто-синхронизация versionCode/versionName из package.json в build.gradle. Больше не нужно править версии в двух местах.' },
    { type: 'new', text: 'Android: если в Firebase Console настроен google-services.json, FCM push включается автоматически из секрета.' },
    { type: 'improve', text: 'Android: ProGuard-правила для Capacitor, WebView JS-бриджа, Cordova плагинов и Google Ads (минификация пока отключена — включим после тестирования с logcat).' },
    { type: 'improve', text: 'Android: AAB bundle splits по density/language/abi — меньший размер у пользователя при установке из Play.' },
    { type: 'improve', text: 'Android: NN-веса (.bin) не сжимаются в APK — WebView мапит их напрямую, а не распаковывает в память.' },

    // ─── Security ───
    { type: 'security', text: 'Минимальная длина пароля поднята с 6 до 8 символов (NIST 800-63B). Касается только новых регистраций — старые аккаунты не затронуты.' },
    { type: 'security', text: 'AdMob ID-шники вынесены в env-переменные вместо хардкода в коде. В production подтягиваются из GH Secrets, в dev работают Google test IDs.' },

    // ─── Observability ───
    { type: 'new', text: 'Sentry-интеграция (опциональная): stack traces с source maps, breadcrumbs, replay при ошибке, release tracking. Активируется через VITE_SENTRY_DSN, без DSN продолжает работать собственный /api/error-report.' },
    { type: 'new', text: 'Snappy analytics: каждый показ маскота-комментатора трекается с event/pose/lang — в админке видно какие фразы срабатывают чаще, не спамим ли.' },

    // ─── CI/CD ───
    { type: 'fix', text: 'CI: исправлен битый yaml-синтаксис в deploy.yml из-за которого весь deploy-workflow не парсился GitHub Actions — сайт не обновлялся при push. secrets.X вынесены в job-level env.' },
    { type: 'fix', text: 'CI: sync-android-version идемпотентен — не падает если версии уже синхронизированы.' },
    { type: 'fix', text: 'CI: release-android.yml — тот же фикс secrets.X в if-условиях через env.HAS_FCM/HAS_ADMOB.' },
  ],
  changes_en: [
    // ─── Android ───
    { type: 'new', text: 'Android: release signing and AAB workflow for Play Store. Keystore via GitHub Secrets, signed AAB builds on demand in Actions.' },
    { type: 'new', text: 'Android: auto-sync of versionCode/versionName from package.json to build.gradle. No more editing versions in two places.' },
    { type: 'new', text: 'Android: if google-services.json is configured in Firebase Console, FCM push enables automatically from secret.' },
    { type: 'improve', text: 'Android: ProGuard rules for Capacitor, WebView JS bridge, Cordova plugins and Google Ads (minification temporarily off — will re-enable after logcat testing).' },
    { type: 'improve', text: 'Android: AAB bundle splits by density/language/abi — smaller install size for users installing via Play.' },
    { type: 'improve', text: 'Android: NN weights (.bin) not compressed in APK — WebView maps them directly instead of unpacking to memory.' },

    // ─── Security ───
    { type: 'security', text: 'Minimum password length raised from 6 to 8 chars (NIST 800-63B). Applies to new registrations only — existing accounts unaffected.' },
    { type: 'security', text: 'AdMob IDs moved from hardcoded placeholders to env vars. Production pulls from GH Secrets, dev uses Google test IDs.' },

    // ─── Observability ───
    { type: 'new', text: 'Sentry integration (optional): stack traces with source maps, breadcrumbs, replay on error, release tracking. Activates via VITE_SENTRY_DSN, without DSN the existing /api/error-report keeps working.' },
    { type: 'new', text: 'Snappy analytics: each mascot phrase reveal tracked with event/pose/lang — admin sees which lines land best, prevents spam.' },

    // ─── CI/CD ───
    { type: 'fix', text: 'CI: fixed broken yaml syntax in deploy.yml that prevented the entire deploy workflow from parsing on GitHub Actions — site was not updating on push. secrets.X moved to job-level env.' },
    { type: 'fix', text: 'CI: sync-android-version is idempotent — does not fail if versions already in sync.' },
    { type: 'fix', text: 'CI: release-android.yml — same secrets.X fix in if-conditions via env.HAS_FCM/HAS_ADMOB.' },
  ],
}
