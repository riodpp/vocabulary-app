-- Migration: Drop subscriptions table
-- Created: 2025-09-08

-- Drop indexes first
DROP INDEX IF EXISTS idx_subscriptions_stripe_customer_id;
DROP INDEX IF EXISTS idx_subscriptions_user_id;

-- Drop table
DROP TABLE IF EXISTS subscriptions CASCADE;
