-- Add Currency Support for Internationalization
-- Created: 2026-02-14
-- Description: Add primary and secondary currency fields to restaurants table

-- ============================================================================
-- ADD CURRENCY COLUMNS TO RESTAURANTS
-- ============================================================================

DO $$
BEGIN
  -- Add primary currency column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='restaurants' AND column_name='primary_currency') THEN
    ALTER TABLE restaurants ADD COLUMN primary_currency TEXT DEFAULT 'USD'
      CHECK (primary_currency IN ('USD', 'MXN', 'PLN', 'EUR', 'GBP', 'CAD', 'AUD'));
  END IF;

  -- Add secondary currency column (optional)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='restaurants' AND column_name='secondary_currency') THEN
    ALTER TABLE restaurants ADD COLUMN secondary_currency TEXT
      CHECK (secondary_currency IN ('USD', 'MXN', 'PLN', 'EUR', 'GBP', 'CAD', 'AUD') OR secondary_currency IS NULL);
  END IF;

  -- Add constraint to ensure primary and secondary currencies are different
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                 WHERE table_name='restaurants' AND constraint_name='different_currencies') THEN
    ALTER TABLE restaurants ADD CONSTRAINT different_currencies
      CHECK (primary_currency != secondary_currency OR secondary_currency IS NULL);
  END IF;
END $$;

-- ============================================================================
-- UPDATE EXISTING RESTAURANTS WITH APPROPRIATE CURRENCIES
-- ============================================================================

-- Set default currencies based on country_code if available
UPDATE restaurants
SET primary_currency = CASE
  WHEN country_code = 'MX' THEN 'MXN'
  WHEN country_code = 'PL' THEN 'PLN'
  WHEN country_code = 'US' THEN 'USD'
  WHEN country_code = 'CA' THEN 'CAD'
  WHEN country_code = 'GB' THEN 'GBP'
  WHEN country_code = 'AU' THEN 'AUD'
  ELSE 'USD'
END
WHERE primary_currency IS NULL;

-- ============================================================================
-- ADD INDEXES FOR CURRENCY QUERIES
-- ============================================================================

CREATE INDEX IF NOT EXISTS restaurants_primary_currency_idx ON restaurants(primary_currency);
CREATE INDEX IF NOT EXISTS restaurants_secondary_currency_idx ON restaurants(secondary_currency);

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Added currency support to restaurants table';
  RAISE NOTICE 'Primary currency: required, defaults to USD';
  RAISE NOTICE 'Secondary currency: optional, for multi-currency support';
  RAISE NOTICE 'Auto-assigned currencies based on country_code';
  RAISE NOTICE '========================================';
END $$;