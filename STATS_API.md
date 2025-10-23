# 📊 Statistics API Documentation

## Новые эндпоинты для статистики продуктивности

### 1. Общая статистика продуктивности
```
GET /stats/productivity
```

**Ответ:**
```json
{
  "admins": [
    {
      "id": 1,
      "name": "Admin Name",
      "email": "admin@example.com",
      "carsAdded": 25,
      "soldCars": 18,
      "errorsCount": 3,
      "productivityScore": 72,
      "lastActivity": "2024-01-15T10:30:00Z",
      "isActive": true
    }
  ],
  "topProductive": [...],
  "topUnproductive": [...],
  "topProblematic": [...],
  "totalAdmins": 5,
  "totalCars": 150,
  "totalErrors": 25
}
```

### 2. Статистика конкретного админа
```
GET /stats/admin/:adminId/productivity
```

**Ответ:**
```json
{
  "id": 1,
  "name": "Admin Name",
  "email": "admin@example.com",
  "carsAdded": 25,
  "soldCars": 18,
  "errorsCount": 3,
  "productivityScore": 72,
  "lastActivity": "2024-01-15T10:30:00Z",
  "isActive": true
}
```

### 3. Статистика автомобилей
```
GET /stats/cars
```

**Ответ:**
```json
{
  "totalCars": 150,
  "soldCars": 45,
  "availableCars": 105,
  "deletedCars": 12,
  "monthlyStats": [
    {
      "month": "янв. 2024",
      "count": 15
    }
  ]
}
```

### 4. Статистика ошибок
```
GET /stats/errors
```

**Ответ:**
```json
{
  "errorTypes": [
    {
      "type": "Validation Error",
      "count": 12
    },
    {
      "type": "Database Error",
      "count": 8
    }
  ],
  "totalErrors": 45,
  "lastUpdated": "2024-01-15T10:30:00Z"
}
```

## 🚀 Развертывание

### 1. Установка зависимостей
```bash
cd car-api
npm install
```

### 2. Настройка базы данных
Убедитесь, что в `.env` файле настроены переменные:
```env
MYSQLHOST=localhost
MYSQLPORT=3306
MYSQLDATABASE=auto
MYSQLUSER=root
MYSQLPASSWORD=root
```

### 3. Запуск в режиме разработки
```bash
npm run start:dev
```

### 4. Сборка для продакшена
```bash
npm run build
npm run start:prod
```

## 🔧 Настройка

### Переменные окружения
- `MYSQLHOST` - хост базы данных
- `MYSQLPORT` - порт базы данных
- `MYSQLDATABASE` - имя базы данных
- `MYSQLUSER` - пользователь базы данных
- `MYSQLPASSWORD` - пароль базы данных

### CORS настройки
API настроен для работы с фронтендом на:
- `http://localhost:4200` (разработка)
- `https://car-admin-production-7255.up.railway.app` (продакшен)

## 📝 Примечания

1. **Ошибки**: Временная реализация для подсчета ошибок. В будущем можно добавить таблицу `errors` для реального отслеживания.

2. **Продуктивность**: Рассчитывается как процент проданных автомобилей от общего количества добавленных.

3. **Кэширование**: В будущем можно добавить Redis для кэширования статистики.

4. **Авторизация**: Все эндпоинты требуют авторизации (кроме публичных).

## 🐛 Отладка

### Проверка работы API
```bash
# Проверка общей статистики
curl -X GET "http://localhost:3000/stats/productivity" \
  -H "Cookie: connect.sid=your-session-cookie"

# Проверка статистики автомобилей
curl -X GET "http://localhost:3000/stats/cars" \
  -H "Cookie: connect.sid=your-session-cookie"
```

### Логи
```bash
# Просмотр логов
npm run start:dev 2>&1 | grep -i "stats"
```
