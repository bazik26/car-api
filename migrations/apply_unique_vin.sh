#!/bin/bash

# Скрипт для применения уникального constraint на VIN код

echo "Применение миграции add_unique_vin_constraint.sql..."
echo ""
echo "Выберите окружение:"
echo "1) Production (Railway)"
echo "2) Local"
read -p "Ваш выбор (1 или 2): " choice

case $choice in
  1)
    echo "Применение к Production базе данных через Railway..."
    cd "$(dirname "$0")/.." || exit
    railway run --service car-api bash -c 'mysql -h $MYSQLHOST -P $MYSQLPORT -u $MYSQLUSER -p$MYSQLPASSWORD $MYSQLDATABASE < migrations/add_unique_vin_constraint.sql'
    ;;
  2)
    read -p "Введите имя базы данных [auto]: " db_name
    db_name=${db_name:-auto}
    read -p "Введите пользователя [root]: " db_user
    db_user=${db_user:-root}
    read -sp "Введите пароль [root]: " db_pass
    db_pass=${db_pass:-root}
    echo ""
    
    mysql -u "$db_user" -p"$db_pass" "$db_name" < migrations/add_unique_vin_constraint.sql
    ;;
  *)
    echo "Неверный выбор"
    exit 1
    ;;
esac

echo ""
echo "Миграция применена успешно!"
echo "Теперь VIN коды должны быть уникальными в базе данных."

