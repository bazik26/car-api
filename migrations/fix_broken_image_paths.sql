-- Миграция для исправления путей к изображениям
-- Дата: 2025-09-30
-- Описание: Заменяем старые URL с shop-ytb-client.onrender.com на car-api URL
-- Затрагивает только сломанные изображения, не трогает работающие (GCS)

-- Показываем количество записей, которые будут обновлены
SELECT 
  COUNT(*) as broken_images_count,
  'Images with shop-ytb-client.onrender.com URLs' as description
FROM files
WHERE path LIKE '%shop-ytb-client.onrender.com%';

-- Обновляем пути: заменяем shop-ytb-client.onrender.com на car-api URL
UPDATE files
SET path = REPLACE(path, 'https://shop-ytb-client.onrender.com', 'https://car-api-production.up.railway.app')
WHERE path LIKE '%shop-ytb-client.onrender.com%';

-- Проверяем результат
SELECT 
  COUNT(*) as remaining_broken_count,
  'Remaining broken images (should be 0)' as description
FROM files
WHERE path LIKE '%shop-ytb-client.onrender.com%';

-- Показываем примеры обновленных путей
SELECT 
  id,
  carId,
  filename,
  path,
  updatedAt
FROM files
WHERE path LIKE '%car-api-production.up.railway.app%'
LIMIT 10;



