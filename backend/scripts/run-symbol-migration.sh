#!/bin/bash

echo "Starting Symbol Margins Migration..."
echo

# Check if Node.js is available
if ! command -v node &> /dev/null; then
    echo "Error: Node.js is not installed or not in PATH"
    echo "Please install Node.js and try again"
    exit 1
fi

# Check if npm is available
if ! command -v npm &> /dev/null; then
    echo "Error: npm is not installed or not in PATH"
    echo "Please install npm and try again"
    exit 1
fi

echo "Node.js version:"
node --version
echo

echo "Running TypeScript migration script..."
npx ts-node scripts/migrate-symbol-margins.ts

if [ $? -ne 0 ]; then
    echo
    echo "Migration failed! Check the error messages above."
    exit 1
fi

echo
echo "Migration completed successfully!"
echo
echo "Next steps:"
echo "1. Update your Prisma schema by running: npx prisma generate"
echo "2. Restart your backend server"
echo "3. Update your frontend to use the new unified Symbol Margins page"
echo
