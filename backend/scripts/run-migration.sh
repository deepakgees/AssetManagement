#!/bin/bash

echo "Running database migration to add totp_secret column..."
echo

# Check if the column already exists
if psql -h localhost -U postgres -d asset_management -c "SELECT column_name FROM information_schema.columns WHERE table_name = 'accounts' AND column_name = 'totp_secret';" | grep -q "totp_secret"; then
    echo "Column totp_secret already exists in accounts table."
else
    echo "Adding totp_secret column to accounts table..."
    psql -h localhost -U postgres -d asset_management -f scripts/add-totp-secret-column.sql
    if [ $? -eq 0 ]; then
        echo "Migration completed successfully!"
    else
        echo "Migration failed. Please check the error messages above."
        exit 1
    fi
fi

echo
echo "Migration script completed."
