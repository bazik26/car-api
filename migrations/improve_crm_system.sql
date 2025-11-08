-- ========================================
-- УЛУЧШЕНИЕ CRM-СИСТЕМЫ ДЛЯ ЛИДОВ
-- ========================================
-- Добавляет новые поля и функционал для полноценной CRM
-- Дата: 2025-11-08
-- Автор: Auto Broker Team

-- ========================================
-- 1. Добавляем новые поля в таблицу leads
-- ========================================

ALTER TABLE leads 
ADD COLUMN IF NOT EXISTS pipeline_stage VARCHAR(50) DEFAULT 'new_lead' AFTER status;

ALTER TABLE leads 
ADD COLUMN IF NOT EXISTS budget JSON NULL AFTER pipeline_stage
COMMENT 'Бюджет клиента: {min: number, max: number, currency: string}';

ALTER TABLE leads 
ADD COLUMN IF NOT EXISTS car_preferences JSON NULL AFTER budget
COMMENT 'Предпочтения по авто: {brands: [], models: [], yearFrom, yearTo, maxMileage, bodyType, gearbox, fuel}';

ALTER TABLE leads 
ADD COLUMN IF NOT EXISTS city VARCHAR(255) NULL AFTER car_preferences
COMMENT 'Город клиента';

ALTER TABLE leads 
ADD COLUMN IF NOT EXISTS region VARCHAR(255) NULL AFTER city
COMMENT 'Регион клиента';

ALTER TABLE leads 
ADD COLUMN IF NOT EXISTS timeline TEXT NULL AFTER region
COMMENT 'Когда планирует покупку';

ALTER TABLE leads 
ADD COLUMN IF NOT EXISTS objections TEXT NULL AFTER timeline
COMMENT 'Возражения клиента';

ALTER TABLE leads 
ADD COLUMN IF NOT EXISTS shown_cars JSON NULL AFTER objections
COMMENT 'ID показанных автомобилей [1, 2, 3]';

ALTER TABLE leads 
ADD COLUMN IF NOT EXISTS contact_attempts INT DEFAULT 0 AFTER shown_cars
COMMENT 'Количество попыток связаться';

ALTER TABLE leads 
ADD COLUMN IF NOT EXISTS last_contact_attempt_at DATETIME NULL AFTER contact_attempts
COMMENT 'Дата последней попытки связаться';

-- ========================================
-- 2. Индексы для оптимизации запросов
-- ========================================

CREATE INDEX IF NOT EXISTS idx_leads_pipeline_stage ON leads(pipeline_stage);
CREATE INDEX IF NOT EXISTS idx_leads_city ON leads(city);
CREATE INDEX IF NOT EXISTS idx_leads_region ON leads(region);
CREATE INDEX IF NOT EXISTS idx_leads_contact_attempts ON leads(contact_attempts);

-- ========================================
-- 3. Обновляем существующие лиды
-- ========================================

-- Устанавливаем pipeline_stage на основе status
UPDATE leads 
SET pipeline_stage = CASE
  WHEN status = 'new' THEN 'new_lead'
  WHEN status = 'in_progress' THEN 'qualification'
  WHEN status = 'contacted' THEN 'needs_analysis'
  WHEN status = 'closed' AND converted_to_client = 1 THEN 'won'
  WHEN status = 'lost' THEN 'lost'
  ELSE 'new_lead'
END
WHERE pipeline_stage IS NULL OR pipeline_stage = 'new_lead';

-- ========================================
-- 4. Комментарии для новых значений pipeline_stage
-- ========================================

-- Возможные значения pipeline_stage:
-- 'new_lead' - Новый лид (только создан)
-- 'first_contact' - Первый контакт (0-2 часа)
-- 'qualification' - Квалификация (2-24 часа)
-- 'needs_analysis' - Выявление потребностей (1-3 дня)
-- 'presentation' - Презентация (3-7 дней)
-- 'negotiation' - Переговоры (7-14 дней)
-- 'deal_closing' - Закрытие сделки (14-30 дней)
-- 'won' - Успешная сделка
-- 'lost' - Отказ

-- ========================================
-- 5. Проверка миграции
-- ========================================

SELECT 
  COUNT(*) as total_leads,
  SUM(CASE WHEN pipeline_stage IS NOT NULL THEN 1 ELSE 0 END) as leads_with_stage,
  SUM(CASE WHEN budget IS NOT NULL THEN 1 ELSE 0 END) as leads_with_budget,
  SUM(CASE WHEN car_preferences IS NOT NULL THEN 1 ELSE 0 END) as leads_with_preferences
FROM leads;

-- ========================================
-- ГОТОВО! ✅
-- ========================================
-- После применения миграции:
-- 1. Все существующие лиды получат pipeline_stage
-- 2. Новые поля готовы для использования
-- 3. Индексы созданы для быстрого поиска
-- 4. CRM система готова к использованию

