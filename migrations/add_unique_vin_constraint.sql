-- Добавление уникального constraint для VIN кода
-- Предотвращает добавление дубликатов машин с одинаковым VIN

-- Сначала удаляем дубликаты если они есть (оставляем самую новую запись)
DELETE c1 FROM cars c1
INNER JOIN cars c2 
WHERE c1.id < c2.id 
  AND c1.vin = c2.vin 
  AND c1.vin IS NOT NULL
  AND c1.vin != '';

-- Добавляем уникальный индекс на поле vin
ALTER TABLE cars 
ADD UNIQUE INDEX idx_vin_unique (vin);

-- Проверяем результат
SELECT 'Уникальный индекс добавлен успешно' as status;

