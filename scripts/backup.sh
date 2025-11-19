#!/bin/sh

# Backup script for MongoDB
# Runs periodically and creates backups

BACKUP_DIR="/backups"
MONGO_HOST="${MONGO_HOST:-mongodb}"
MONGO_PORT="${MONGO_PORT:-27017}"
MONGO_DATABASE="${MONGO_DATABASE:-proposal-builder}"
MONGO_USERNAME="${MONGO_USERNAME:-admin}"
MONGO_PASSWORD="${MONGO_PASSWORD:-adminpassword}"
BACKUP_INTERVAL="${BACKUP_INTERVAL:-3600}"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

echo "Starting MongoDB backup service..."
echo "Backup interval: ${BACKUP_INTERVAL} seconds"
echo "Backup directory: $BACKUP_DIR"
echo "Database: $MONGO_DATABASE"

while true; do
  TIMESTAMP=$(date +%Y%m%d_%H%M%S)
  BACKUP_PATH="$BACKUP_DIR/backup_$TIMESTAMP"
  
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting backup..."

  # Ensure target folder exists even if mongodump fails to create it
  mkdir -p "$BACKUP_PATH"
  
  # Create backup
  mongodump --host "$MONGO_HOST:$MONGO_PORT" \
    --username="$MONGO_USERNAME" \
    --password="$MONGO_PASSWORD" \
    --authenticationDatabase=admin \
    --db="$MONGO_DATABASE" \
    --out="$BACKUP_PATH"
  
  if [ $? -eq 0 ]; then
    if [ ! "$(ls -A "$BACKUP_PATH" 2>/dev/null)" ]; then
      echo "[$(date '+%Y-%m-%d %H:%M:%S')] Warning: mongodump succeeded but produced no files in $BACKUP_PATH. Skipping archive."
      rm -rf "$BACKUP_PATH"
      sleep "$BACKUP_INTERVAL"
      continue
    fi

    # Compress backup
    cd "$BACKUP_DIR"
    tar -czf "backup_${TIMESTAMP}.tar.gz" "backup_$TIMESTAMP"
    rm -rf "backup_$TIMESTAMP"
    
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Backup completed: backup_${TIMESTAMP}.tar.gz"
    
    # Keep only last 7 backups (you can adjust this number)
    ls -t backup_*.tar.gz | tail -n +8 | xargs -r rm
    
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Old backups cleaned (keeping last 7)"
  else
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Backup failed!"
  fi
  
  # Wait for next backup
  sleep "$BACKUP_INTERVAL"
done

