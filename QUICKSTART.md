# Быстрый старт

## 1. Подготовка дампа базы данных

Поместите дамп вашей MongoDB Atlas базы данных в папку `mongodb-dump/`:

```bash
# Структура должна быть:
mongodb-dump/
└── proposal-builder/  (или имя вашей БД)
    ├── screens.bson
    ├── screens.metadata.json
    └── ...
```

Подробные инструкции по получению дампа см. в `MONGODB_DUMP_INSTRUCTIONS.md`

## 2. Создание файла .env

Создайте файл `.env` в корне проекта:

```bash
cat > .env << EOF
MONGO_ROOT_USERNAME=admin
MONGO_ROOT_PASSWORD=your_secure_password_here
MONGO_DATABASE=proposal-builder
BACKUP_INTERVAL=3600
EOF
```

Или скопируйте `.env.example` и отредактируйте:

```bash
cp .env.example .env
nano .env  # или используйте ваш редактор
```

## 3. Запуск

```bash
# Сборка и запуск
docker-compose up -d

# Просмотр логов
docker-compose logs -f
```

## 4. Доступ

Приложение будет доступно по IP адресу сервера на порту 80:
- `http://your-server-ip`
- `http://localhost` (локально)

## Что дальше?

- Проверьте логи инициализации: `docker-compose logs mongo-init`
- Проверьте, что приложение запущено: `docker-compose ps`
- Бэкапы будут создаваться автоматически в папке `backups/`

## Остановка

```bash
docker-compose down
```

## Полная переустановка (с удалением данных)

```bash
docker-compose down -v
docker-compose up -d
```

