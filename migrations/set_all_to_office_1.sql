-- Миграция: привязка всех существующих лидов, машин и админов к офису 1
-- Устанавливает projectId = 'office_1' для всех записей, где projectId NULL или не указан

-- Обновляем всех админов (если projectId NULL или пустой)
UPDATE `admins`
SET `projectId` = 'office_1'
WHERE `projectId` IS NULL
   OR `projectId` = ''
   OR `projectId` NOT IN ('office_1', 'office_2');

-- Обновляем все машины (если projectId NULL или пустой)
UPDATE `cars`
SET `projectId` = 'office_1'
WHERE `projectId` IS NULL
   OR `projectId` = ''
   OR `projectId` NOT IN ('office_1', 'office_2');

-- Обновляем все лиды (если projectId NULL или пустой)
UPDATE `leads`
SET `projectId` = 'office_1'
WHERE `projectId` IS NULL
   OR `projectId` = ''
   OR `projectId` NOT IN ('office_1', 'office_2');










