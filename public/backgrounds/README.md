# Backgrounds

Фоновые картинки за игровым полем.

## Текущие файлы (залить руками)

- `mobile.webp` — портретный (для экранов < 768px), вход phone_portrait_1080x1920.png
- `desktop.webp` — landscape (планшет/desktop), вход desktop_2560x1440.png
- `desktop-4k.webp` — retina/4K, вход desktop_4k_3840x2160.png

## Как залить

1. Открыть https://github.com/igor1000rr/stolbiki/upload/main/public/backgrounds
2. Drag-drop все 3 .webp файла в окно браузера
3. Внизу нажать Commit changes

Или локально:

```
cp /path/to/*.webp public/backgrounds/
git add public/backgrounds/*.webp
git commit -m "add: background images"
git push
```

## Регенерация webp из png

```
cwebp -q 82 -m 6 input.png -o output.webp
```

Качество 82 даёт ~20x уменьшение при практически неразличимом качестве для illustrated art.
