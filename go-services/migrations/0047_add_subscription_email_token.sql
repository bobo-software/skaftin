-- Migration: Add subscription_email_token on skaftin_system_payment_transactions
-- (Paystack disable requires subscription_code + email_token).
-- Applies to every existing project schema that already has payment transactions.

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT table_schema
    FROM information_schema.tables
    WHERE table_name = 'skaftin_system_payment_transactions'
  LOOP
    EXECUTE format(
      'ALTER TABLE %I.skaftin_system_payment_transactions ADD COLUMN IF NOT EXISTS subscription_email_token VARCHAR(255)',
      r.table_schema
    );
    RAISE NOTICE 'Added subscription_email_token in schema: %', r.table_schema;
  END LOOP;
END $$;
