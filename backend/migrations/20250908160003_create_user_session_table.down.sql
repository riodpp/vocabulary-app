-- Migration: Drop user_sessions table
-- Created: 2025-09-08

-- Drop indexes first
DROP INDEX IF EXISTS idx_user_sessions_user_id;
DROP INDEX IF EXISTS idx_user_sessions_token;

-- Drop table
DROP TABLE IF EXISTS user_sessions CASCADE;
