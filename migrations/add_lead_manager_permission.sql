-- ========================================
-- ДОБАВЛЕНИЕ РОЛИ LEAD MANAGER
-- ========================================
-- Добавляет поддержку роли "Lead Manager" - руководитель отдела продаж
-- Lead Manager видит ВСЕХ лидов и ВСЕ задачи (как супер-админ для лидов)
-- Дата: 2025-11-08

-- ========================================
-- 1. Обновляем permissions для существующих админов
-- ========================================

-- Проверяем структуру permissions
SELECT id, email, isSuper, permissions 
FROM admins 
WHERE deletedAt IS NULL 
LIMIT 5;

-- Добавляем isLeadManager: false для всех существующих админов (если permissions не null)
UPDATE admins 
SET permissions = JSON_SET(
  COALESCE(permissions, '{}'),
  '$.isLeadManager',
  false
)
WHERE deletedAt IS NULL 
  AND permissions IS NOT NULL;

-- Для админов где permissions = NULL, устанавливаем дефолтные права
UPDATE admins 
SET permissions = JSON_OBJECT(
  'canAddCars', true,
  'canViewCars', true,
  'canManageLeads', true,
  'canViewLeads', true,
  'isLeadManager', false
)
WHERE deletedAt IS NULL 
  AND permissions IS NULL;

-- ========================================
-- 2. Проверка результата
-- ========================================

SELECT 
  id,
  email,
  isSuper,
  JSON_EXTRACT(permissions, '$.isLeadManager') as isLeadManager,
  JSON_EXTRACT(permissions, '$.canManageLeads') as canManageLeads,
  permissions
FROM admins 
WHERE deletedAt IS NULL;

-- ========================================
-- 3. ИНСТРУКЦИЯ: Как назначить Lead Manager
-- ========================================

-- Вариант 1: Через SQL (вручную)
/*
UPDATE admins 
SET permissions = JSON_SET(permissions, '$.isLeadManager', true)
WHERE email = 'manager@example.com';
*/

-- Вариант 2: Через админку (UI)
-- 1. Зайти в админку
-- 2. Раздел "Админы"
-- 3. Создать/редактировать админа
-- 4. Отметить чекбокс "Lead Manager"

-- ========================================
-- 4. КТО ВИДИТ ЧТО:
-- ========================================

-- ОБЫЧНЫЙ АДМИН:
--   - Видит только лидов из своего офиса (projectId)
--   - Видит только свои задачи (assignedAdminId)

-- LEAD MANAGER (isLeadManager: true):
--   - Видит ВСЕХ лидов из ВСЕХ офисов
--   - Видит ВСЕ задачи всех менеджеров
--   - Может контролировать работу всех менеджеров

-- СУПЕР-АДМИН (isSuper: true):
--   - Видит абсолютно всё
--   - Полный доступ к системе

-- ========================================
-- ГОТОВО! ✅
-- ========================================

