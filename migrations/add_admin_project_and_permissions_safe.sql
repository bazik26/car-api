-- Миграция: добавление полей projectId и permissions в таблицу admins
-- и обновление всех существующих админов

-- Проверяем и добавляем колонку projectId
SET @dbname = DATABASE();
SET @tablename = 'admins';
SET @columnname = 'projectId';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (column_name = @columnname)
  ) > 0,
  'SELECT 1',
  CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN `', @columnname, '` ENUM(\'office_1\', \'office_2\') NULL DEFAULT \'office_1\' AFTER `isSuper`')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Проверяем и добавляем колонку permissions
SET @columnname = 'permissions';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (column_name = @columnname)
  ) > 0,
  'SELECT 1',
  CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN `', @columnname, '` JSON NULL AFTER `projectId`')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Устанавливаем дефолтные значения для ВСЕХ активных админов: первый офис и все разрешения
UPDATE `admins` 
SET 
  `projectId` = 'office_1',
  `permissions` = JSON_OBJECT(
    'canAddCars', true,
    'canViewCars', true,
    'canManageLeads', true,
    'canViewLeads', true
  )
WHERE `deletedAt` IS NULL;

-- Также обновляем админов, у которых projectId или permissions NULL или пустые
UPDATE `admins` 
SET 
  `projectId` = COALESCE(`projectId`, 'office_1'),
  `permissions` = COALESCE(
    `permissions`, 
    JSON_OBJECT(
      'canAddCars', true,
      'canViewCars', true,
      'canManageLeads', true,
      'canViewLeads', true
    )
  )
WHERE `projectId` IS NULL 
   OR `permissions` IS NULL 
   OR `permissions` = 'null' 
   OR `permissions` = '{}'
   OR JSON_LENGTH(`permissions`) = 0;

