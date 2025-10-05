#!/bin/bash

echo "Fixing accounts table sequence issue..."
echo

# Run the sequence fix script
psql -h localhost -U postgres -d asset_management -f scripts/fix-accounts-sequence.sql

if [ $? -eq 0 ]; then
    echo "Sequence fix completed successfully!"
    echo "The accounts table sequence has been reset."
else
    echo "Sequence fix failed. Please check the error messages above."
    exit 1
fi

echo
echo "Sequence fix script completed."
