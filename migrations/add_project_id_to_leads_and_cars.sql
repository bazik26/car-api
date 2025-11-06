-- Миграция: добавление поля projectId в таблицы leads и cars

-- Добавляем projectId в таблицу leads
ALTER TABLE `leads` 
ADD COLUMN `projectId` ENUM('office_1', 'office_2') NULL DEFAULT 'office_1' AFTER `assignedAdminId`;

-- Устанавливаем projectId = 'office_1' для всех существующих лидов
UPDATE `leads` 
SET `projectId` = 'office_1'
WHERE `projectId` IS NULL;

-- Добавляем projectId в таблицу cars
ALTER TABLE `cars` 
ADD COLUMN `projectId` ENUM('office_1', 'office_2') NULL DEFAULT 'office_1' AFTER `promoSold`;

-- Устанавливаем projectId = 'office_1' для всех существующих машин
UPDATE `cars` 
SET `projectId` = 'office_1'
WHERE `projectId` IS NULL;

