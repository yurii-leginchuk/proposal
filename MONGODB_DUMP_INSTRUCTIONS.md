# Инструкция по получению дампа из MongoDB Atlas

## Получение дампа из MongoDB Atlas

### Вариант 1: Через MongoDB Atlas UI (рекомендуется)

1. Войдите в MongoDB Atlas
2. Перейдите в ваш кластер
3. Нажмите на кнопку **"..."** (три точки) рядом с вашим кластером
4. Выберите **"Download Backup"** или **"Command Line Tools"**
5. Следуйте инструкциям для скачивания дампа

### Вариант 2: Через mongodump (командная строка)

Если у вас установлен MongoDB Tools локально:

```bash
# Получите connection string из MongoDB Atlas
# Формат: mongodb+srv://username:password@cluster.mongodb.net/database?retryWrites=true&w=majority

# Создайте дамп
mongodump --uri="mongodb+srv://username:password@cluster.mongodb.net/proposal-builder?retryWrites=true&w=majority" --out=./mongodb-dump

# Или если используете обычный connection string:
mongodump --host="cluster-shard-00-00.xxxxx.mongodb.net:27017" \
  --username="your-username" \
  --password="your-password" \
  --authenticationDatabase=admin \
  --db=proposal-builder \
  --out=./mongodb-dump
```

### Вариант 3: Через MongoDB Compass

1. Установите MongoDB Compass
2. Подключитесь к вашему MongoDB Atlas кластеру
3. Используйте встроенную функцию экспорта данных

## Подготовка дампа для Docker

После получения дампа, структура должна быть следующей:

```
mongodb-dump/
└── proposal-builder/  (или имя вашей БД)
    ├── screens.bson
    ├── screens.metadata.json
    ├── clients.bson
    ├── clients.metadata.json
    ├── templates.bson
    ├── templates.metadata.json
    ├── proposals.bson
    └── proposals.metadata.json
```

**Важно:** 
- Если у вас дамп в корне `mongodb-dump/`, переместите содержимое в подпапку с именем базы данных
- Или просто поместите дамп так, чтобы структура была `mongodb-dump/your-database-name/`

## Проверка дампа

Убедитесь, что дамп содержит файлы `.bson` и `.metadata.json`:

```bash
ls -la mongodb-dump/proposal-builder/
```

## После размещения дампа

1. Поместите дамп в папку `mongodb-dump/` проекта
2. Убедитесь, что структура правильная (см. выше)
3. Запустите Docker Compose:
   ```bash
   docker-compose up -d
   ```
4. Проверьте логи инициализации:
   ```bash
   docker-compose logs mongo-init
   ```

Если все прошло успешно, вы увидите сообщение:
```
Database restored successfully from dump!
```

