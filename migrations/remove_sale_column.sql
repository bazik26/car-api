-- Миграция для удаления колонки sale из таблицы cars
-- Дата: 2025-01-27
-- Описание: Удаляем дублирующую колонку sale, оставляем только isSold

-- Проверяем существование колонки sale перед удалением
SET @column_exists = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'cars'
    AND COLUMN_NAME = 'sale'
);

-- Удаляем колонку sale только если она существует
SET @sql = IF(@column_exists > 0, 
  'ALTER TABLE cars DROP COLUMN sale', 
  'SELECT "Column sale does not exist, skipping migration" as message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Проверяем результат
SELECT 
  CASE 
    WHEN @column_exists > 0 THEN 'Column sale successfully removed'
    ELSE 'Column sale was not found, no changes made'
  END as migration_result;





































