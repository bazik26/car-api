-- Создание таблицы пользователей
CREATE TABLE IF NOT EXISTS `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `fingerprint` varchar(255) NOT NULL UNIQUE,
  `name` varchar(255) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `ipAddress` varchar(255) DEFAULT NULL,
  `userAgent` text DEFAULT NULL,
  `isActive` tinyint(1) NOT NULL DEFAULT 1,
  `lastSeenAt` datetime DEFAULT NULL,
  `createdAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `IDX_users_fingerprint` (`fingerprint`),
  KEY `IDX_users_isActive` (`isActive`),
  KEY `IDX_users_lastSeenAt` (`lastSeenAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Добавление связи пользователя с сессиями чата
ALTER TABLE `chat_sessions` 
ADD COLUMN `userId` int DEFAULT NULL AFTER `assignedAdminId`,
ADD KEY `FK_chat_sessions_userId` (`userId`),
ADD CONSTRAINT `FK_chat_sessions_userId` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- Добавление индексов для оптимизации
CREATE INDEX `IDX_chat_sessions_userId` ON `chat_sessions` (`userId`);
CREATE INDEX `IDX_chat_sessions_isActive` ON `chat_sessions` (`isActive`);
CREATE INDEX `IDX_chat_sessions_createdAt` ON `chat_sessions` (`createdAt`);

-- Добавление индексов для сообщений
CREATE INDEX `IDX_chat_messages_sessionId` ON `chat_messages` (`sessionId`);
CREATE INDEX `IDX_chat_messages_createdAt` ON `chat_messages` (`createdAt`);
CREATE INDEX `IDX_chat_messages_senderType` ON `chat_messages` (`senderType`);
