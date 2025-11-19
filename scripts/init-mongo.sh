#!/bin/bash

MONGO_HOST="${MONGO_HOST:-mongodb}"
MONGO_USERNAME="${MONGO_ROOT_USERNAME:-admin}"
MONGO_PASSWORD="${MONGO_ROOT_PASSWORD:-adminpassword}"
DB_NAME="${MONGO_DATABASE:-proposal-builder}"

# Wait for MongoDB to be ready
echo "Waiting for MongoDB to be ready..."
until mongosh --host "$MONGO_HOST" --username="$MONGO_USERNAME" --password="$MONGO_PASSWORD" --authenticationDatabase=admin --eval "print('MongoDB is ready')" > /dev/null 2>&1; do
  sleep 2
done

echo "MongoDB is ready!"

# Check if database exists and has collections
DB_EXISTS=$(mongosh --host "$MONGO_HOST" --username="$MONGO_USERNAME" --password="$MONGO_PASSWORD" --authenticationDatabase=admin --quiet --eval "db.getMongo().getDBNames().indexOf('$DB_NAME') >= 0" 2>/dev/null)

if [ "$DB_EXISTS" = "true" ]; then
  COLLECTION_COUNT=$(mongosh --host "$MONGO_HOST" --username="$MONGO_USERNAME" --password="$MONGO_PASSWORD" --authenticationDatabase=admin --quiet --eval "db.getSiblingDB('$DB_NAME').getCollectionNames().length" 2>/dev/null)
  
  if [ "$COLLECTION_COUNT" -gt 0 ]; then
    echo "Database $DB_NAME already exists and has $COLLECTION_COUNT collections. Skipping initialization."
    exit 0
  fi
fi

echo "Database $DB_NAME is empty or doesn't exist. Checking for dump files..."

# Look for dump files in /mongodb-dump
if [ -d "/mongodb-dump" ] && [ "$(ls -A /mongodb-dump 2>/dev/null)" ]; then
  echo "Found dump files. Restoring database..."
  
  # Check if there's a directory with the database name
  if [ -d "/mongodb-dump/$DB_NAME" ]; then
    DUMP_DIR="/mongodb-dump/$DB_NAME"
  else
    # Try to find any subdirectory
    DUMP_DIR=$(find /mongodb-dump -mindepth 1 -maxdepth 1 -type d | head -1)
    if [ -z "$DUMP_DIR" ]; then
      DUMP_DIR="/mongodb-dump"
    fi
  fi

  # If chosen directory doesn't contain BSON files directly, look deeper
  if ! find "$DUMP_DIR" -maxdepth 1 -type f -name "*.bson" | grep -q .; then
    echo "No BSON files directly in $DUMP_DIR. Searching subdirectories..."
    DEEPEST_DIR=$(find "$DUMP_DIR" -type f -name "*.bson" | sed 's|/[^/]*$||' | sort -u | head -1)
    if [ -n "$DEEPEST_DIR" ]; then
      DUMP_DIR="$DEEPEST_DIR"
    fi
  fi

  if ! find "$DUMP_DIR" -maxdepth 1 -type f -name "*.bson" | grep -q .; then
    echo "Warning: No BSON files found in $DUMP_DIR. Cannot restore database."
    exit 0
  fi
  
  echo "Restoring from: $DUMP_DIR"
  
  # Restore the dump
  mongorestore --host "$MONGO_HOST" \
    --username="$MONGO_USERNAME" \
    --password="$MONGO_PASSWORD" \
    --authenticationDatabase=admin \
    --db="$DB_NAME" \
    --drop \
    "$DUMP_DIR"
  
  if [ $? -eq 0 ]; then
    echo "Database restored successfully from dump!"
  else
    echo "Warning: Failed to restore from dump. Database will be empty."
  fi
else
  echo "No dump files found in /mongodb-dump. Database will be empty."
fi

