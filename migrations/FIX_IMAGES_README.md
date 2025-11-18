# Исправление проблемы с загрузкой изображений

## Суть проблемы

**15 ноября 2025** был коммит `2350db9`, который изменил физическое расположение файлов:

### ДО изменения (работало ✅):
- Файлы сохранялись: `./images/file.jpg`
- В БД: `path: "file.jpg"`
- ServeStaticModule раздавал из `images/` по корню `/`
- Запрос `/file.jpg` → находил `images/file.jpg` ✅

### ПОСЛЕ изменения (сломалось ❌):
- Файлы сохраняются: `./images/cars/001550/file.jpg`
- В БД: `path: "file.jpg"` **(не обновили!)**
- ServeStaticModule раздает из `images/` по корню `/`
- Запрос `/file.jpg` → ищет `images/file.jpg`, но файла там нет ❌

## Решение

### 1. Обновление кода ✅ (уже сделано)

Обновлен метод `uploadCarImages` в `car.service.ts`:
```typescript
path: `cars/${paddedCarId}/${file.filename}`
```

Теперь новые загрузки будут работать правильно.

### 2. Миграция базы данных ⚠️ (нужно применить)

Исправляет пути для файлов, загруженных **после 15 ноября**:

```bash
cd car-api
./migrations/apply_fix_image_paths.sh
```

Или вручную через Railway:
```bash
railway run bash -c 'mysql -h $MYSQLHOST -P $MYSQLPORT -u $MYSQLUSER -p$MYSQLPASSWORD $MYSQLDATABASE < migrations/fix_image_paths.sql'
```

### 3. Деплой обновленного кода

```bash
cd car-api
git add .
git commit -m "fix: save correct image paths to database (cars/{paddedCarId}/{filename})"
git push
```

Railway автоматически задеплоит изменения.

## Проверка

После применения миграции и деплоя:

1. Откройте админку
2. Проверьте, что изображения машин отображаются
3. Загрузите новое изображение и убедитесь, что оно сразу отображается

## Технические детали

- Старые файлы (до 15 ноября) остаются в корне `images/` и продолжат работать
- Новые файлы (после 15 ноября) физически в `images/cars/CARID/`
- Миграция обновляет только пути для новых файлов
- ServeStaticModule настроен раздавать все из `images/` по корню `/`

