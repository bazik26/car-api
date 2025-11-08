-- Миграция для добавления колонки promo в таблицу cars
-- Дата: 2025-01-27
-- Описание: Добавляем новую колонку promo типа boolean с дефолтным значением null

-- Проверяем существование колонки promo перед добавлением
SET @column_exists = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'cars'
    AND COLUMN_NAME = 'promo'
);

-- Добавляем колонку promo только если она не существует
SET @sql = IF(@column_exists = 0, 
  'ALTER TABLE cars ADD COLUMN promo BOOLEAN NULL AFTER isSold', 
  'SELECT "Column promo already exists, skipping migration" as message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Проверяем результат
SELECT 
  CASE 
    WHEN @column_exists = 0 THEN 'Column promo successfully added'
    ELSE 'Column promo already exists, no changes made'
  END as migration_result;

-- Показываем структуру таблицы для проверки
DESCRIBE cars;






























