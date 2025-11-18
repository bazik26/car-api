-- Исправление путей к изображениям в таблице files
-- 
-- Проблема: С 15 ноября файлы физически сохраняются в images/cars/CARID/,
-- но в БД записывается только имя файла.
-- Это сломало отображение изображений.
--
-- Решение: Обновляем path для файлов, загруженных после 15 ноября 2025,
-- добавляя префикс cars/CARID/ к пути.
--
-- Файлы, загруженные ДО 15 ноября, остаются без изменений (они в корне images/).

UPDATE files f
JOIN cars c ON f.carId = c.id
SET f.path = CONCAT('cars/', LPAD(c.id, 6, '0'), '/', f.filename)
WHERE f.path NOT LIKE 'http%'      -- Не трогаем внешние URL
  AND f.path NOT LIKE 'cars/%'     -- Не трогаем уже исправленные пути  
  AND f.path NOT LIKE 'images/%'   -- Не трогаем старые пути с префиксом images/
  AND f.createdAt >= '2025-11-15'  -- Только файлы после изменения структуры
  AND f.deletedAt IS NULL;         -- Только активные записи

-- Показываем статистику обновлений
SELECT 
  'Файлов обновлено' as status,
  COUNT(*) as count
FROM files f
JOIN cars c ON f.carId = c.id
WHERE f.path LIKE 'cars/%'
  AND f.createdAt >= '2025-11-15'
  AND f.deletedAt IS NULL;

