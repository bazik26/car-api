-- Миграция: добавление полей projectId и permissions в таблицу admins

ALTER TABLE `admins` 
ADD COLUMN `projectId` ENUM('office_1', 'office_2') NULL DEFAULT 'office_1' AFTER `isSuper`,
ADD COLUMN `permissions` JSON NULL AFTER `projectId`;

-- Устанавливаем дефолтные значения для всех админов: первый офис и все разрешения
UPDATE `admins` 
SET 
  `projectId` = 'office_1',
  `permissions` = JSON_OBJECT(
    'canAddCars', true,
    'canViewCars', true,
    'canManageLeads', true,
    'canViewLeads', true
  )
WHERE `projectId` IS NULL OR `permissions` IS NULL OR `permissions` = 'null';

