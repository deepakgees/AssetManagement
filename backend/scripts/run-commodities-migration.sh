#!/bin/bash

echo "Running commodities schema migration..."
echo

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "Error: DATABASE_URL environment variable is not set"
    echo "Please set it in your .env file or environment"
    exit 1
fi

# Run the migration script
echo "Executing migration script..."
psql "$DATABASE_URL" -f migrate-commodities-schema.sql

if [ $? -eq 0 ]; then
    echo
    echo "Migration completed successfully!"
    echo
    echo "Next steps:"
    echo "1. Run 'npx prisma generate' to update the Prisma client"
    echo "2. Restart your backend server"
    echo "3. Verify the migration was successful"
    echo "4. Drop the backup table when ready: DROP TABLE historical_price_commodities_backup;"
else
    echo
    echo "Migration failed! Please check the error messages above."
    echo "The backup table 'historical_price_commodities_backup' was created before the migration."
fi

echo
