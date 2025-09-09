-- Migration: Drop users table
-- Created: 2025-09-08

-- Drop indexes first
DROP INDEX IF EXISTS idx_users_verification_code;
DROP INDEX IF EXISTS idx_users_email;

-- Drop table
DROP TABLE IF EXISTS users CASCADE;
