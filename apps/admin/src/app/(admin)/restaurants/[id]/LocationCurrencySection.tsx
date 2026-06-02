'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  SUPPORTED_CURRENCIES,
  getCurrencyForCountry,
  getCurrencyInfo,
  isSupportedCurrency,
  type SupportedCurrency,
} from '@eatme/shared';
import { updateAdminRestaurantBasics } from './actions/restaurant';

// The 25 ISO 3166-1 alpha-2 countries we map to currencies (kept in lockstep
// with packages/shared/src/logic/currency.ts COUNTRY_TO_CURRENCY). Display
// names are inlined here — there's no shared country-name table, and the
// admin-only picker isn't worth pulling Intl.DisplayNames over.
const COUNTRY_OPTIONS: Array<{ code: string; name: string }> = [
  { code: 'AR', name: 'Argentina' },
  { code: 'AU', name: 'Australia' },
  { code: 'AT', name: 'Austria' },
  { code: 'BE', name: 'Belgium' },
  { code: 'BR', name: 'Brazil' },
  { code: 'CA', name: 'Canada' },
  { code: 'CL', name: 'Chile' },
  { code: 'CO', name: 'Colombia' },
  { code: 'EC', name: 'Ecuador' },
  { code: 'SV', name: 'El Salvador' },
  { code: 'FI', name: 'Finland' },
  { code: 'FR', name: 'France' },
  { code: 'DE', name: 'Germany' },
  { code: 'GR', name: 'Greece' },
  { code: 'IE', name: 'Ireland' },
  { code: 'IT', name: 'Italy' },
  { code: 'JP', name: 'Japan' },
  { code: 'MX', name: 'Mexico' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'PA', name: 'Panama' },
  { code: 'PL', name: 'Poland' },
  { code: 'PT', name: 'Portugal' },
  { code: 'ES', name: 'Spain' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'US', name: 'United States' },
].sort((a, b) => a.name.localeCompare(b.name));

const KNOWN_COUNTRY_CODES = new Set(COUNTRY_OPTIONS.map(o => o.code));

interface Props {
  restaurantId: string;
  // Required by updateAdminRestaurantBasics's Zod schema (min(2)); we pass it
  // through so this section can call the action without a separate "set name"
  // mutation.
  restaurantName: string;
  countryCode: string | null;
  currencyCode: string;
}

export function LocationCurrencySection({
  restaurantId,
  restaurantName,
  countryCode,
  currencyCode,
}: Props) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState('');

  const initialCountry = (countryCode ?? '').toUpperCase();
  const initialCurrency: SupportedCurrency = isSupportedCurrency(currencyCode)
    ? currencyCode
    : 'USD';

  // Two-mode picker: a mapped country picks from the dropdown; an unmapped
  // country goes via the "Other" branch and uses customCountry. Currency
  // auto-fills from country on change but is independently editable.
  const [countrySelect, setCountrySelect] = useState<string>(
    initialCountry === '' || KNOWN_COUNTRY_CODES.has(initialCountry) ? initialCountry : '__custom__'
  );
  const [customCountry, setCustomCountry] = useState<string>(
    initialCountry !== '' && !KNOWN_COUNTRY_CODES.has(initialCountry) ? initialCountry : ''
  );
  const [currencyDraft, setCurrencyDraft] = useState<SupportedCurrency>(initialCurrency);

  function resolveDraftCountry(): string {
    if (countrySelect === '__custom__') return customCountry.trim().toUpperCase();
    return countrySelect;
  }

  function isDirty(): boolean {
    return resolveDraftCountry() !== initialCountry || currencyDraft !== initialCurrency;
  }

  function handleCountryChange(next: string) {
    setCountrySelect(next);
    if (next !== '' && next !== '__custom__') {
      setCurrencyDraft(getCurrencyForCountry(next));
    }
  }

  function resetDrafts() {
    setCountrySelect(
      initialCountry === '' || KNOWN_COUNTRY_CODES.has(initialCountry)
        ? initialCountry
        : '__custom__'
    );
    setCustomCountry(
      initialCountry !== '' && !KNOWN_COUNTRY_CODES.has(initialCountry) ? initialCountry : ''
    );
    setCurrencyDraft(initialCurrency);
  }

  function handleSave() {
    setError('');
    const finalCountry = resolveDraftCountry();

    if (countrySelect === '__custom__' && finalCountry !== '') {
      if (!/^[A-Z]{2}$/.test(finalCountry)) {
        setError('Custom country must be a 2-letter ISO code (e.g. NZ).');
        return;
      }
    }

    if (!isDirty()) {
      setIsEditing(false);
      return;
    }

    startTransition(async () => {
      const result = await updateAdminRestaurantBasics(restaurantId, {
        name: restaurantName,
        country_code: finalCountry === '' ? '' : finalCountry,
        currency_code: currencyDraft,
      });
      if (!result.ok) {
        setError(result.formError ?? 'Update failed');
        return;
      }
      setIsEditing(false);
      // revalidatePath inside the action invalidates the server cache; refresh
      // re-renders this page with the new values + (importantly) propagates
      // the new currency down to all price-input editors below.
      router.refresh();
    });
  }

  const currentCountryLabel =
    countryCode == null || countryCode === ''
      ? '—'
      : (COUNTRY_OPTIONS.find(o => o.code === countryCode.toUpperCase())?.name ??
        countryCode.toUpperCase());
  const currentCurrencyInfo = isSupportedCurrency(currencyCode)
    ? getCurrencyInfo(currencyCode)
    : null;

  if (!isEditing) {
    return (
      <section className="rounded-lg border border-border p-4 space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-sm">Location & currency</h2>
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="text-xs text-primary hover:underline"
          >
            Edit
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="flex gap-2">
            <span className="w-24 shrink-0 text-muted-foreground text-xs">Country</span>
            <span className="text-foreground">{currentCountryLabel}</span>
          </div>
          <div className="flex gap-2">
            <span className="w-24 shrink-0 text-muted-foreground text-xs">Currency</span>
            <span className="text-foreground">
              {currentCurrencyInfo
                ? `${currentCurrencyInfo.code} (${currentCurrencyInfo.symbol}) — ${currentCurrencyInfo.name}`
                : currencyCode}
            </span>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-primary/40 bg-muted/20 p-4 space-y-3">
      <h2 className="font-semibold text-sm">Location & currency</h2>

      <div className="grid grid-cols-2 gap-3">
        <label className="text-xs">
          <span className="block text-muted-foreground mb-1">Country</span>
          <select
            value={countrySelect}
            onChange={e => handleCountryChange(e.target.value)}
            disabled={isPending}
            className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm disabled:opacity-50"
          >
            <option value="">— Not set —</option>
            {COUNTRY_OPTIONS.map(o => (
              <option key={o.code} value={o.code}>
                {o.name} ({o.code})
              </option>
            ))}
            <option value="__custom__">Other (enter ISO code)…</option>
          </select>
          {countrySelect === '__custom__' && (
            <input
              type="text"
              value={customCountry}
              onChange={e => setCustomCountry(e.target.value.toUpperCase().slice(0, 2))}
              placeholder="NZ"
              maxLength={2}
              className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm uppercase"
            />
          )}
        </label>

        <label className="text-xs">
          <span className="block text-muted-foreground mb-1">Currency</span>
          <select
            value={currencyDraft}
            onChange={e => setCurrencyDraft(e.target.value as SupportedCurrency)}
            disabled={isPending}
            className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm disabled:opacity-50"
          >
            {SUPPORTED_CURRENCIES.map(c => {
              const info = getCurrencyInfo(c);
              return (
                <option key={c} value={c}>
                  {c} ({info.symbol}) — {info.name}
                </option>
              );
            })}
          </select>
          <p className="mt-1 text-[10px] text-muted-foreground/80">
            Auto-fills from country; override if menu prices use a different currency (e.g. resort
            in Mexico pricing in USD).
          </p>
        </label>
      </div>

      {error && <p className="text-destructive text-xs">{error}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {isPending ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          onClick={() => {
            setIsEditing(false);
            setError('');
            resetDrafts();
          }}
          disabled={isPending}
          className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-muted disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </section>
  );
}
