#!/bin/bash

echo "Starting Lot Size Column Migration..."
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

echo "Step 1: Adding lot_size column to symbol_margins table..."
npx ts-node scripts/add-lot-size-migration.ts

if [ $? -ne 0 ]; then
    echo
    echo "Migration failed! Check the error messages above."
    exit 1
fi

echo
echo "Step 2: Generating Prisma client..."
npx prisma generate

if [ $? -ne 0 ]; then
    echo
    echo "Prisma generate failed! Check the error messages above."
    exit 1
fi

echo
echo "Step 3: Populating lot sizes for existing symbols..."
npx ts-node scripts/populate-lot-sizes.ts

if [ $? -ne 0 ]; then
    echo
    echo "Lot size population failed! Check the error messages above."
    echo "You can run the population script again later."
    exit 1
fi

echo
echo "Migration completed successfully!"
echo
echo "Next steps:"
echo "1. Restart your backend server"
echo "2. The lot_size field is now available in the symbol_margins table"
echo

