-- Создание таблицы лидов
CREATE TABLE IF NOT EXISTS `leads` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `email` varchar(255) DEFAULT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `source` varchar(50) NOT NULL DEFAULT 'chat' COMMENT 'Источник: chat, telegram, phone, email, other',
  `status` varchar(50) NOT NULL DEFAULT 'new' COMMENT 'Статус: new, in_progress, contacted, closed, lost',
  `priority` varchar(20) DEFAULT 'normal' COMMENT 'Приоритет: low, normal, high, urgent',
  `hasTelegramContact` tinyint(1) NOT NULL DEFAULT 0 COMMENT 'Есть контакт в Telegram',
  `telegramUsername` varchar(255) DEFAULT NULL COMMENT 'Username в Telegram',
  `chatSessionId` varchar(255) DEFAULT NULL COMMENT 'ID сессии чата, если лид из чата',
  `assignedAdminId` int DEFAULT NULL COMMENT 'Назначенный админ',
  `description` text DEFAULT NULL COMMENT 'Дополнительное описание',
  `createdAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `IDX_leads_status` (`status`),
  KEY `IDX_leads_source` (`source`),
  KEY `IDX_leads_assignedAdminId` (`assignedAdminId`),
  KEY `IDX_leads_chatSessionId` (`chatSessionId`),
  KEY `IDX_leads_createdAt` (`createdAt`),
  CONSTRAINT `FK_leads_assignedAdminId` FOREIGN KEY (`assignedAdminId`) REFERENCES `admins` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Создание таблицы комментариев к лидам
CREATE TABLE IF NOT EXISTS `lead_comments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `leadId` int NOT NULL,
  `adminId` int NOT NULL,
  `comment` text NOT NULL,
  `createdAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `IDX_lead_comments_leadId` (`leadId`),
  KEY `IDX_lead_comments_adminId` (`adminId`),
  KEY `IDX_lead_comments_createdAt` (`createdAt`),
  CONSTRAINT `FK_lead_comments_leadId` FOREIGN KEY (`leadId`) REFERENCES `leads` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `FK_lead_comments_adminId` FOREIGN KEY (`adminId`) REFERENCES `admins` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


