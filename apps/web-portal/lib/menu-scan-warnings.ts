import type { EditableMenu, ExtractionNote } from './menu-scan';

export type WarningSeverity = 'error' | 'warning' | 'info';
export type WarningSource = 'rule' | 'ai';

export interface MenuWarning {
  severity: WarningSeverity;
  message: string;
  /** Human-readable path, e.g. "Food Menu > Tacos > Unnamed dish" */
  path: string;
  /** 'rule' = deterministic check, 'ai' = AI-reported (defaults to 'rule') */
  source?: WarningSource;
  /** Optional proposed fix from AI */
  suggestion?: string;
}

const SUSPICIOUS_PRICE_THRESHOLD = 500;

/** Per-currency upper price thresholds above which a dish price is flagged as suspicious. */
const CURRENCY_PRICE_THRESHOLDS: Record<string, number> = {
  USD: 150,
  EUR: 150,
  GBP: 120,
  CAD: 200,
  AUD: 200,
  MXN: 2000,
  PLN: 600,
  BRL: 800,
  ARS: 50000,
  COP: 150000,
  INR: 5000,
  JPY: 20000,
  CNY: 1000,
};

function getSuspiciousPriceThreshold(currency: string): number {
  return CURRENCY_THRESHOLDS[currency.toUpperCase()] ?? SUSPICIOUS_PRICE_THRESHOLD;
}

// Alias kept for the fallback reference above
const CURRENCY_THRESHOLDS = CURRENCY_PRICE_THRESHOLDS;

/**
 * Scans editable menus for data quality issues.
 * Pure function — no side effects.
 *
 * @param currency - ISO 4217 currency code (e.g. "MXN", "USD") used to
 *   calibrate the suspicious-price threshold. Defaults to "USD".
 */
export function computeMenuWarnings(menus: EditableMenu[], currency = 'USD'): MenuWarning[] {
  const warnings: MenuWarning[] = [];
  const highPriceThreshold = getSuspiciousPriceThreshold(currency);

  for (const menu of menus) {
    const menuLabel = menu.name || 'Unnamed menu';

    for (const cat of menu.categories) {
      const catLabel = cat.name?.trim() || 'Unnamed category';
      const catPath = `${menuLabel} > ${catLabel}`;

      // Empty category name
      if (!cat.name?.trim()) {
        warnings.push({
          severity: 'warning',
          message: 'Category has no name',
          path: catPath,
        });
      }

      // Track names for duplicate detection
      const nameCount = new Map<string, number>();
      for (const dish of cat.dishes) {
        const key = dish.name.toLowerCase().trim();
        if (key) nameCount.set(key, (nameCount.get(key) ?? 0) + 1);
      }

      for (const dish of cat.dishes) {
        const dishLabel = dish.name?.trim() || 'Unnamed dish';
        const dishPath = `${catPath} > ${dishLabel}`;
        const price = typeof dish.price === 'string' ? parseFloat(dish.price) : dish.price;

        // Empty dish name
        if (dish.name.trim().length < 2) {
          warnings.push({
            severity: 'error',
            message: 'Dish name is missing or too short',
            path: dishPath,
          });
        }

        // Low AI extraction confidence
        if (dish.confidence < 0.3) {
          warnings.push({
            severity: 'error',
            message: 'Very low extraction confidence — review carefully',
            path: dishPath,
          });
        } else if (dish.confidence < 0.5) {
          warnings.push({
            severity: 'warning',
            message: 'Low extraction confidence (likely OCR issue)',
            path: dishPath,
          });
        }

        // Zero/missing price (only for "exact" pricing — skip market_price, ask_server, etc.)
        if (dish.display_price_prefix === 'exact' && (!price || price <= 0)) {
          warnings.push({
            severity: 'error',
            message: 'Dish has no price',
            path: dishPath,
          });
        }

        // Suspiciously high price
        if (price > highPriceThreshold) {
          warnings.push({
            severity: 'warning',
            message: `Price looks unusually high for ${currency} (${price})`,
            path: dishPath,
          });
        }

        // Duplicate dish name in same category
        const key = dish.name.toLowerCase().trim();
        if (key && (nameCount.get(key) ?? 0) > 1) {
          warnings.push({
            severity: 'warning',
            message: 'Duplicate dish name in this category',
            path: dishPath,
          });
        }

        // No ingredients
        if (dish.ingredients.length === 0) {
          warnings.push({
            severity: 'info',
            message: 'No ingredients listed',
            path: dishPath,
          });
        }

        // Unmatched ingredients
        const unmatched = dish.ingredients.filter(i => i.status === 'unmatched');
        if (unmatched.length > 0) {
          warnings.push({
            severity: 'info',
            message: `${unmatched.length} unmatched ingredient${unmatched.length > 1 ? 's' : ''}`,
            path: dishPath,
          });
        }
      }
    }
  }

  // Deduplicate duplicate-dish warnings (show once per name, not once per occurrence)
  const seen = new Set<string>();
  return warnings.filter(w => {
    if (w.message === 'Duplicate dish name in this category') {
      const key = `dup:${w.path}`;
      if (seen.has(key)) return false;
      seen.add(key);
    }
    return true;
  });
}

/**
 * Converts AI-reported extraction notes into UI warnings.
 * Each note becomes a MenuWarning with source='ai'.
 */
export function extractionNotesToWarnings(notes: ExtractionNote[]): MenuWarning[] {
  const typeToSeverity: Record<ExtractionNote['type'], WarningSeverity> = {
    likely_ocr_error: 'error',
    price_outlier: 'warning',
    ingredient_mismatch: 'warning',
    dish_category_mismatch: 'warning',
    unreadable_section: 'info',
  };
  return notes.map(n => ({
    severity: typeToSeverity[n.type],
    message: n.message,
    path: n.path,
    source: 'ai' as const,
    suggestion: n.suggestion ?? undefined,
  }));
}
