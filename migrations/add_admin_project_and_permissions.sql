-- Миграция: добавление полей projectId и permissions в таблицу admins
-- и обновление всех существующих админов

-- Добавляем колонки (если колонки уже существуют, будет ошибка - это нормально)
ALTER TABLE `admins` 
ADD COLUMN `projectId` ENUM('office_1', 'office_2') NULL DEFAULT 'office_1' AFTER `isSuper`,
ADD COLUMN `permissions` JSON NULL AFTER `projectId`;

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

