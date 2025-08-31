#!/bin/bash

echo "Starting duplicate cleanup process..."
echo

# Change to script directory
cd "$(dirname "$0")"

# Run the cleanup script
node scripts/cleanup-duplicates.js

echo
echo "Cleanup completed."
