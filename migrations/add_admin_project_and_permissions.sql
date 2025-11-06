-- Миграция: добавление полей projectId и permissions в таблицу admins

ALTER TABLE `admins` 
ADD COLUMN `projectId` ENUM('office_1', 'office_2') NULL AFTER `isSuper`,
ADD COLUMN `permissions` JSON NULL AFTER `projectId`;

-- Обновление существующих записей: устанавливаем дефолтные разрешения для супер-админов
UPDATE `admins` 
SET `permissions` = JSON_OBJECT(
  'canAddCars', true,
  'canViewCars', true,
  'canManageLeads', true,
  'canViewLeads', true
)
WHERE `isSuper` = 1 AND (`permissions` IS NULL OR `permissions` = 'null');

-- Устанавливаем дефолтные разрешения для обычных админов
UPDATE `admins` 
SET `permissions` = JSON_OBJECT(
  'canAddCars', false,
  'canViewCars', true,
  'canManageLeads', false,
  'canViewLeads', true
)
WHERE `isSuper` = 0 AND (`permissions` IS NULL OR `permissions` = 'null');

