-- Добавление функций CRM для лидов

-- 1. История изменений (Activity Log)
CREATE TABLE IF NOT EXISTS `lead_activities` (
  `id` int NOT NULL AUTO_INCREMENT,
  `leadId` int NOT NULL,
  `adminId` int DEFAULT NULL,
  `activityType` varchar(50) NOT NULL,
  `field` varchar(100) DEFAULT NULL,
  `oldValue` text DEFAULT NULL,
  `newValue` text DEFAULT NULL,
  `description` text DEFAULT NULL,
  `createdAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `FK_lead_activities_leadId` (`leadId`),
  KEY `FK_lead_activities_adminId` (`adminId`),
  KEY `IDX_lead_activities_createdAt` (`createdAt`),
  CONSTRAINT `FK_lead_activities_leadId` FOREIGN KEY (`leadId`) REFERENCES `leads` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `FK_lead_activities_adminId` FOREIGN KEY (`adminId`) REFERENCES `admins` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Задачи и напоминания (Tasks)
CREATE TABLE IF NOT EXISTS `lead_tasks` (
  `id` int NOT NULL AUTO_INCREMENT,
  `leadId` int NOT NULL,
  `adminId` int NOT NULL,
  `title` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `dueDate` datetime DEFAULT NULL,
  `completed` tinyint(1) NOT NULL DEFAULT 0,
  `completedAt` datetime DEFAULT NULL,
  `createdAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `FK_lead_tasks_leadId` (`leadId`),
  KEY `FK_lead_tasks_adminId` (`adminId`),
  KEY `IDX_lead_tasks_dueDate` (`dueDate`),
  KEY `IDX_lead_tasks_completed` (`completed`),
  CONSTRAINT `FK_lead_tasks_leadId` FOREIGN KEY (`leadId`) REFERENCES `leads` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `FK_lead_tasks_adminId` FOREIGN KEY (`adminId`) REFERENCES `admins` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Теги для лидов
CREATE TABLE IF NOT EXISTS `lead_tags` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `color` varchar(7) DEFAULT '#4f8cff',
  `createdAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UQ_lead_tags_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Связь лидов и тегов (many-to-many)
CREATE TABLE IF NOT EXISTS `lead_tag_relations` (
  `leadId` int NOT NULL,
  `tagId` int NOT NULL,
  `createdAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`leadId`, `tagId`),
  KEY `FK_lead_tag_relations_tagId` (`tagId`),
  CONSTRAINT `FK_lead_tag_relations_leadId` FOREIGN KEY (`leadId`) REFERENCES `leads` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `FK_lead_tag_relations_tagId` FOREIGN KEY (`tagId`) REFERENCES `lead_tags` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Файлы и вложения
CREATE TABLE IF NOT EXISTS `lead_attachments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `leadId` int NOT NULL,
  `adminId` int DEFAULT NULL,
  `fileName` varchar(255) NOT NULL,
  `filePath` varchar(500) NOT NULL,
  `fileSize` int DEFAULT NULL,
  `mimeType` varchar(100) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `createdAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `FK_lead_attachments_leadId` (`leadId`),
  KEY `FK_lead_attachments_adminId` (`adminId`),
  CONSTRAINT `FK_lead_attachments_leadId` FOREIGN KEY (`leadId`) REFERENCES `leads` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `FK_lead_attachments_adminId` FOREIGN KEY (`adminId`) REFERENCES `admins` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Встречи и события календаря
CREATE TABLE IF NOT EXISTS `lead_meetings` (
  `id` int NOT NULL AUTO_INCREMENT,
  `leadId` int NOT NULL,
  `adminId` int NOT NULL,
  `title` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `meetingDate` datetime NOT NULL,
  `location` varchar(255) DEFAULT NULL,
  `meetingType` varchar(50) DEFAULT 'call',
  `completed` tinyint(1) NOT NULL DEFAULT 0,
  `createdAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `FK_lead_meetings_leadId` (`leadId`),
  KEY `FK_lead_meetings_adminId` (`adminId`),
  KEY `IDX_lead_meetings_meetingDate` (`meetingDate`),
  CONSTRAINT `FK_lead_meetings_leadId` FOREIGN KEY (`leadId`) REFERENCES `leads` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `FK_lead_meetings_adminId` FOREIGN KEY (`adminId`) REFERENCES `admins` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Дополнительные поля для лидов
ALTER TABLE `leads` 
  ADD COLUMN IF NOT EXISTS `score` int DEFAULT 0 COMMENT 'Lead scoring (0-100)',
  ADD COLUMN IF NOT EXISTS `convertedToClient` tinyint(1) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS `convertedAt` datetime DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `lastContactedAt` datetime DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `nextFollowUpDate` datetime DEFAULT NULL;

-- 7. Автоматизация (Workflow Rules)
CREATE TABLE IF NOT EXISTS `lead_workflow_rules` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `triggerCondition` text NOT NULL,
  `actionType` varchar(50) NOT NULL,
  `actionConfig` text DEFAULT NULL,
  `isActive` tinyint(1) NOT NULL DEFAULT 1,
  `createdAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Индексы для оптимизации
CREATE INDEX IF NOT EXISTS `IDX_leads_score` ON `leads` (`score`);
CREATE INDEX IF NOT EXISTS `IDX_leads_convertedToClient` ON `leads` (`convertedToClient`);
CREATE INDEX IF NOT EXISTS `IDX_leads_nextFollowUpDate` ON `leads` (`nextFollowUpDate`);













