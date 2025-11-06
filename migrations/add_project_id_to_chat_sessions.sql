-- Миграция: добавление поля projectId в таблицу chat_sessions

ALTER TABLE `chat_sessions` 
ADD COLUMN `projectId` ENUM('office_1', 'office_2') NULL DEFAULT 'office_1' AFTER `projectSource`;

-- Устанавливаем projectId = 'office_1' для всех существующих сессий
UPDATE `chat_sessions` 
SET `projectId` = 'office_1'
WHERE `projectId` IS NULL;

