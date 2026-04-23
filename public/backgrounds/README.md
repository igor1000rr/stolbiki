# Backgrounds

Фоновые картинки за игровым полем — 6 вариантов по breakpoint'у и ориентации.

## Файлы (залить руками через GitHub web UI)

| Файл | Размер | Когда служит |
|------|---------|----------------|
| mobile-portrait.webp  | 1080×1672 / 174KB | телефон вертикально (дефолт) |
| mobile-landscape.webp | 1920×1080 / 133KB | телефон горизонтально |
| tablet-portrait.webp  | 1536×2048 / 144KB | iPad вертикально |
| tablet-landscape.webp | 2048×1536 / 122KB | iPad горизонтально |
| desktop.webp          | 2560×1440 / 142KB | ноуты, мониторы до 2K |
| desktop-4k.webp       | 3840×2160 / 226KB | retina, 4K |

Браузер грузит только тот файл который подходит под текущий экран — трафик на пользователя никогда > 226 КБ.

## Как залить

1. Открыть https://github.com/igor1000rr/stolbiki/upload/main/public/backgrounds
2. Drag-drop все 6 .webp файлов
3. Commit changes

## Регенерация webp из png

```
cwebp -q 82 -m 6 input.png -o output.webp
```
