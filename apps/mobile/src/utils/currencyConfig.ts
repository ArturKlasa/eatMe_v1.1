/**
 * Currency Configuration — thin re-export.
 *
 * The canonical currency module lives in `@eatme/shared` (commit 2 of the
 * restaurant-currency-handling rollout). This file remains so existing
 * mobile imports (`from '../utils/currencyConfig'`) keep resolving without
 * a sweep — new code should import from `@eatme/shared` directly.
 */

export {
  SUPPORTED_CURRENCIES,
  CURRENCY_CONFIG,
  getCurrencyForCountry,
  getCurrencyInfo,
  getPriceRangeForCurrency,
  formatPrice,
  isSupportedCurrency,
  type SupportedCurrency,
  type CurrencyInfo,
} from '@eatme/shared';
