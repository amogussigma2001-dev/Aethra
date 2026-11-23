# Aethra для Android (APK через GitHub)

Это оболочка: APK открывает твою Aethra по ссылке из `capacitor.config.json`.
Все данные хранятся в Claude — без Supabase и без своих серверов.
Обновления Aethra приходят сами, APK пересобирать не нужно.

## Файлы
- `.github/workflows/build-apk.yml` — сборка APK на GitHub
- `capacitor.config.json` — название, пакет и ссылка на приложение
- `package.json` — зависимости сборки
- `index.html` — запасная страница
- `icon-only.png`, `icon-foreground.png`, `icon-background.png` — иконка приложения
- `Aethra-source.html` — копия кода Aethra на память (в сборке не участвует)

## С компьютера
1. github.com → New repository (любое имя, Public).
2. Распакуй zip и перетащи ВСЁ содержимое, включая папку `.github`, в репозиторий → Commit changes.
3. Вкладка Actions → Build APK. Сборка стартует сама (~8 минут). Если нет — Run workflow.
4. Справа на главной странице репозитория: Releases → Aethra v1 → скачай `app-debug.apk`.

## С телефона
1. Создай репозиторий.
2. Add file → Upload files: загрузи `index.html`, `capacitor.config.json`, `package.json` и три `icon-*.png` → Commit.
3. Add file → Create new file. Имя: `.github/workflows/build-apk.yml`. Вставь содержимое файла `build-apk.yml` → Commit.
4. Actions → Build APK → дождись зелёной галочки → Releases → скачай `app-debug.apk`.

## Установка
Открой APK, разреши установку из этого источника. Если Play Protect предупредит — «Всё равно установить».
Внутри приложения войди в claude.ai тем же аккаунтом.

## Если ссылка на Aethra изменится
Открой `capacitor.config.json` на GitHub (карандаш), поменяй `url`, Commit. Сборка запустится сама.

## Ошибка сборки
Actions → красный запуск → открой шаг с ошибкой → скопируй текст и пришли мне.
