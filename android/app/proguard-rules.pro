# ═══ ProGuard/R8 rules для Highrise Heist ═══
# Минификация включена в release, этот файл дополняет правила плагинов.
#
# Capacitor и большинство Cordova-плагинов поставляют свои consumer-rules.pro,
# которые Gradle подхватывает автоматически. Здесь — только дополнения.

# ─── Stack traces ───
# Сохраняем номера строк и исходные имена файлов — при crash'е в Play Console
# и в нашем error-reports будет видно конкретный src:line вместо obfuscated.
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# ─── Capacitor JS bridge ───
# Мосты JS↔native используют рефлексию. Мы не знаем заранее имена плагинов
# (они загружаются по строковым id из capacitor.config.ts), поэтому keep всё.
-keep class com.getcapacitor.** { *; }
-keep class com.getcapacitor.plugin.** { *; }
-keepclassmembers class * {
    @com.getcapacitor.annotation.CapacitorPlugin *;
    @com.getcapacitor.PluginMethod *;
}

# ─── WebView JS interface ───
# Любые @JavascriptInterface аннотированные методы должны быть keep'нуты.
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# ─── Cordova plugins (используются через capacitor-cordova-android-plugins) ───
-keep class org.apache.cordova.** { *; }
-keepclassmembers class * extends org.apache.cordova.CordovaPlugin {
    public <init>(...);
    public *;
}

# ─── AdMob / Google Play Services (если плагин подключён) ───
# @capacitor-community/admob подтягивает com.google.android.gms.ads.*.
# Их consumer-rules обычно ок, но для страховки:
-keep class com.google.android.gms.ads.** { *; }
-keep class com.google.android.gms.common.** { *; }

# ─── AndroidX / Material ───
# Эти библиотеки имеют свои proguard rules в AAR, keep правила уже встроены.
# Здесь только напоминание: не отключать minify для WebView activity.

# ─── Native-side наших классов нет ───
# Всё приложение — web assets в `dist/`, Android-сторона это только
# MainActivity (Capacitor auto-generates). Если когда-то добавим custom
# native code — добавить keep правила для него здесь.

# ─── Warnings ───
# Подавляем warnings которые Capacitor/Cordova плагины не умеют чинить
# (отсутствующие optional classes при shrinking).
-dontwarn org.apache.cordova.**
-dontwarn com.google.android.gms.**
