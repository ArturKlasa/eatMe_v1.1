-- Migration 044: Add payment_methods column to restaurants
--
-- Stores how the restaurant accepts payment.
-- NULL means the owner hasn't specified yet (shown as "Unknown" in the UI).
-- Default is NULL rather than 'cash_and_card' so existing rows are treated
-- as unspecified rather than incorrectly labelled.

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'restaurants'
      AND column_name  = 'payment_methods'
  ) THEN
    ALTER TABLE public.restaurants
      ADD COLUMN payment_methods text
        CHECK (payment_methods = ANY (ARRAY[
          'cash_only'::text,
          'card_only'::text,
          'cash_and_card'::text
        ]));
  END IF;
END $$;
