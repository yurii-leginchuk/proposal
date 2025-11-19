# Docker Setup Guide

Этот проект настроен для запуска через Docker Compose с автоматической инициализацией базы данных и периодическими бэкапами.

## Структура

- **app** - Node.js приложение
- **mongodb** - MongoDB база данных
- **nginx** - Reverse proxy (доступ на порту 80)
- **backup** - Сервис автоматических бэкапов

## Быстрый старт

### 1. Подготовка дампа базы данных

Перед первым запуском поместите дамп вашей MongoDB Atlas базы данных в папку `mongodb-dump/`:

```bash
# Создайте папку для дампа
mkdir -p mongodb-dump

# Если у вас есть дамп в формате mongodump, поместите его в mongodb-dump/
# Структура должна быть такой:
# mongodb-dump/
#   └── proposal-builder/  (или имя вашей БД)
#       ├── screens.bson
#       ├── screens.metadata.json
#       ├── clients.bson
#       └── ...
```

### 2. Настройка переменных окружения

Создайте файл `.env` на основе `.env.example`:

```bash
cp .env.example .env
```

Отредактируйте `.env` и установите нужные значения:

```env
MONGO_ROOT_USERNAME=admin
MONGO_ROOT_PASSWORD=your_secure_password
MONGO_DATABASE=proposal-builder
BACKUP_INTERVAL=3600  # Интервал бэкапов в секундах (3600 = 1 час)
```

### 3. Запуск приложения

```bash
# Сборка и запуск всех контейнеров
docker-compose up -d

# Просмотр логов
docker-compose logs -f

# Остановка
docker-compose down
```

### 4. Доступ к приложению

После запуска приложение будет доступно по IP адресу сервера на порту 80:
- `http://your-server-ip`
- `http://localhost` (если запущено локально)

## Инициализация базы данных

При первом запуске система автоматически:

1. Проверит, существует ли база данных и есть ли в ней данные
2. Если база пустая, попытается восстановить данные из дампа в папке `mongodb-dump/`
3. Если дампа нет, создаст пустую базу данных

**Важно:** Скрипт инициализации запускается только один раз при первом создании контейнера MongoDB. Если нужно переинициализировать, удалите volume:

```bash
docker-compose down -v
docker-compose up -d
```

## Бэкапы

Сервис бэкапов автоматически создает резервные копии базы данных:

- **Расположение:** `backups/`
- **Формат:** Сжатые tar.gz архивы
- **Имя файла:** `backup_YYYYMMDD_HHMMSS.tar.gz`
- **Хранение:** Последние 7 бэкапов (настраивается в `scripts/backup.sh`)
- **Интервал:** Настраивается через `BACKUP_INTERVAL` в `.env` (по умолчанию 1 час)

### Ручное создание бэкапа

```bash
docker-compose exec mongodb mongodump --username=admin --password=adminpassword --authenticationDatabase=admin --db=proposal-builder --out=/tmp/backup
```

### Восстановление из бэкапа

```bash
# Остановите приложение
docker-compose down

# Скопируйте бэкап в mongodb-dump/
cp backups/backup_YYYYMMDD_HHMMSS.tar.gz /tmp/
cd /tmp && tar -xzf backup_YYYYMMDD_HHMMSS.tar.gz
cp -r backup_YYYYMMDD_HHMMSS/* /path/to/project/mongodb-dump/

# Удалите старые данные и перезапустите
docker-compose down -v
docker-compose up -d
```

## Полезные команды

```bash
# Просмотр логов конкретного сервиса
docker-compose logs -f app
docker-compose logs -f mongodb
docker-compose logs -f nginx
docker-compose logs -f backup

# Перезапуск сервиса
docker-compose restart app

# Вход в контейнер MongoDB
docker-compose exec mongodb mongosh -u admin -p adminpassword --authenticationDatabase admin

# Просмотр статуса
docker-compose ps

# Остановка и удаление всех контейнеров и volumes
docker-compose down -v
```

## Структура папок

```
pa-proposal-builder/
├── docker-compose.yml
├── Dockerfile
├── .env
├── nginx/
│   └── nginx.conf
├── scripts/
│   ├── init-mongo.sh      # Скрипт инициализации БД
│   └── backup.sh          # Скрипт бэкапов
├── mongodb-dump/          # Дамп для инициализации (поместите сюда)
├── backups/               # Автоматические бэкапы (создается автоматически)
└── ...
```

## Troubleshooting

### MongoDB не подключается

Проверьте логи:
```bash
docker-compose logs mongodb
```

Убедитесь, что в `.env` правильные учетные данные.

### Nginx не проксирует запросы

Проверьте, что контейнер `app` запущен:
```bash
docker-compose ps
docker-compose logs app
```

### Бэкапы не создаются

Проверьте логи сервиса backup:
```bash
docker-compose logs backup
```

Убедитесь, что папка `backups/` существует и доступна для записи.

