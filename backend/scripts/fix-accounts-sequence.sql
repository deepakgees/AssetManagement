-- Fix accounts table sequence issue
-- This script resets the sequence for the accounts table to the correct value

-- Step 1: Check current sequence value and max ID
SELECT 
    'Current sequence value:' as info,
    last_value as current_sequence_value
FROM accounts_id_seq;

SELECT 
    'Max ID in accounts table:' as info,
    COALESCE(MAX(id), 0) as max_id
FROM accounts;

-- Step 2: Reset the sequence to the correct value
-- This ensures the next auto-generated ID will be higher than any existing ID
SELECT setval('accounts_id_seq', COALESCE((SELECT MAX(id) FROM accounts), 0) + 1, false);

-- Step 3: Verify the sequence is now correct
SELECT 
    'New sequence value:' as info,
    last_value as new_sequence_value
FROM accounts_id_seq;

-- Step 4: Test that the sequence is working
-- This should not insert anything, just verify the sequence is ready
SELECT nextval('accounts_id_seq') as next_id;
