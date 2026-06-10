'use client';

import { useState } from 'react';
import { getCurrencyInfo, isSupportedCurrency } from '@eatme/shared';
import { compressImage } from '@/lib/upload';
import { adminScanModifierExtras, type ScannedExtras } from '../actions/scanExtras';
import type { ExtractedModifierGroup } from '@/components/modifiers/editableTypes';
import type { ExtractedBundledItem } from './useReviewState';

// Supplementary scan during review (operator issue #12): extract modifier
// groups + bundled items from a screenshot and attach them to the dishes
// selected via the bulk-copy checkboxes. Everything stays in client review
// state until the normal confirm.

const ERROR_MESSAGES: Record<string, string> = {
  NO_API_KEY: 'OPENAI_API_KEY is not configured for the admin app.',
  OPENAI_ERROR: 'OpenAI rejected the request — try again in a moment.',
  TRUNCATED: 'The extraction was cut off — try a tighter crop of just the modifier section.',
  PARSE_FAILED: 'The model returned something unreadable — try again or use a clearer image.',
  EMPTY_RESPONSE: 'The model returned nothing — try again or use a clearer image.',
  VALIDATION: 'The image could not be sent — is it a valid image file?',
};

interface Props {
  currencyCode: string;
  // How many dishes the extraction will attach to (0 disables the attach
  // button) and the human label for them — '2 selected dishes' in bulk mode,
  // '“Tacos al Pastor”' when opened from a single dish's modifier editor.
  targetCount: number;
  targetLabel: string;
  saving: boolean;
  onAttach: (groups: ExtractedModifierGroup[], items: ExtractedBundledItem[]) => void;
  onClose: () => void;
}

type Phase = 'pick' | 'scanning' | 'preview';

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Strip the data-URL prefix; the action wants the bare payload.
      resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function ScanExtrasPanel({
  currencyCode,
  targetCount,
  targetLabel,
  saving,
  onAttach,
  onClose,
}: Props) {
  const currencySymbol = isSupportedCurrency(currencyCode)
    ? getCurrencyInfo(currencyCode).symbol
    : '$';

  const [phase, setPhase] = useState<Phase>('pick');
  const [error, setError] = useState<string | null>(null);
  const [extras, setExtras] = useState<ScannedExtras | null>(null);
  // Indices into extras.modifier_groups / extras.bundled_items the operator
  // kept checked in the preview.
  const [checkedGroups, setCheckedGroups] = useState<Set<number>>(new Set());
  const [checkedItems, setCheckedItems] = useState<Set<number>>(new Set());

  async function handleFile(file: File) {
    setError(null);
    setPhase('scanning');
    try {
      const compressed = await compressImage(file);
      const imageBase64 = await fileToBase64(compressed);
      const result = await adminScanModifierExtras({ imageBase64, currencyCode });
      if (!result.ok) {
        setError(ERROR_MESSAGES[result.formError ?? ''] ?? result.formError ?? 'Scan failed');
        setPhase('pick');
        return;
      }
      if (result.data.modifier_groups.length === 0 && result.data.bundled_items.length === 0) {
        setError('No modifier groups or bundled items were found in that image.');
        setPhase('pick');
        return;
      }
      setExtras(result.data);
      setCheckedGroups(new Set(result.data.modifier_groups.map((_, i) => i)));
      setCheckedItems(new Set(result.data.bundled_items.map((_, i) => i)));
      setPhase('preview');
    } catch {
      setError('Could not read or compress that file.');
      setPhase('pick');
    }
  }

  const toggleIn =
    (setter: typeof setCheckedGroups) =>
    (idx: number): void =>
      setter(prev => {
        const next = new Set(prev);
        if (next.has(idx)) next.delete(idx);
        else next.add(idx);
        return next;
      });
  const toggleGroup = toggleIn(setCheckedGroups);
  const toggleItem = toggleIn(setCheckedItems);

  const keptGroups = extras?.modifier_groups.filter((_, i) => checkedGroups.has(i)) ?? [];
  const keptItems = extras?.bundled_items.filter((_, i) => checkedItems.has(i)) ?? [];
  const nothingKept = keptGroups.length === 0 && keptItems.length === 0;

  function handleAttach() {
    onAttach(keptGroups, keptItems);
  }

  return (
    <div className="rounded-lg border border-sky-300 bg-sky-50/50 p-4 space-y-3 dark:border-sky-900/40 dark:bg-sky-950/20">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-sky-900 dark:text-sky-200">
          Scan modifiers / bundled items from image
        </h3>
        <button
          type="button"
          onClick={onClose}
          disabled={phase === 'scanning'}
          aria-label="Close scan panel"
          className="rounded border border-border px-2 py-1 text-xs hover:bg-muted disabled:opacity-50"
        >
          ✕
        </button>
      </div>

      {phase !== 'preview' && (
        <>
          <p className="text-xs text-muted-foreground">
            Upload a photo or screenshot of a modifier section (&ldquo;choose your protein&rdquo;,
            toppings, combo contents). The extracted groups and items will be attached to{' '}
            <strong>{targetLabel}</strong> — you can review them first.
          </p>
          <input
            type="file"
            accept="image/*"
            aria-label="Modifier section image"
            disabled={phase === 'scanning'}
            onChange={e => {
              const file = e.target.files?.[0];
              // Allow re-picking the same file after an error.
              e.target.value = '';
              if (file) void handleFile(file);
            }}
            className="block w-full text-xs file:mr-3 file:rounded file:border file:border-border file:bg-background file:px-3 file:py-1.5 file:text-xs file:font-medium hover:file:bg-muted disabled:opacity-50"
          />
          {phase === 'scanning' && (
            <p className="text-xs text-sky-900 dark:text-sky-200" role="status">
              Scanning… this usually takes a few seconds.
            </p>
          )}
        </>
      )}

      {phase === 'preview' && extras && (
        <div className="space-y-3">
          {extras.modifier_groups.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium">
                Modifier groups found ({extras.modifier_groups.length}) — untick any you don&rsquo;t
                want:
              </p>
              <ul className="space-y-1.5">
                {extras.modifier_groups.map((g, gi) => (
                  <li
                    key={gi}
                    className="rounded border border-border bg-background p-2 text-xs space-y-1"
                  >
                    <label className="flex items-center gap-2 font-medium">
                      <input
                        type="checkbox"
                        checked={checkedGroups.has(gi)}
                        onChange={() => toggleGroup(gi)}
                        className="h-3.5 w-3.5"
                      />
                      {g.name || '(unnamed group)'}
                      <span className="font-normal text-muted-foreground">
                        · {g.selection_type === 'single' ? 'pick one' : 'pick several'}
                        {g.min_selections === 0 ? ' · optional' : ' · required'}
                      </span>
                    </label>
                    <ul className="pl-6 space-y-0.5 text-muted-foreground">
                      {g.options.map((o, oi) => (
                        <li key={oi}>
                          {o.name}
                          {o.price_override != null
                            ? ` — ${currencySymbol}${o.price_override}`
                            : o.price_delta !== 0
                              ? ` — +${currencySymbol}${o.price_delta}`
                              : ''}
                          {o.primary_protein ? ` (${o.primary_protein})` : ''}
                          {o.is_default ? ' · default' : ''}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {extras.bundled_items.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium">
                Bundled items found ({extras.bundled_items.length}):
              </p>
              <ul className="space-y-1">
                {extras.bundled_items.map((b, bi) => (
                  <li key={bi} className="text-xs">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={checkedItems.has(bi)}
                        onChange={() => toggleItem(bi)}
                        className="h-3.5 w-3.5"
                      />
                      {b.name}
                      {b.note ? <span className="text-muted-foreground">({b.note})</span> : null}
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleAttach}
              disabled={saving || nothingKept || targetCount === 0}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              Attach to {targetLabel}
            </button>
            <button
              type="button"
              onClick={() => {
                setExtras(null);
                setError(null);
                setPhase('pick');
              }}
              disabled={saving}
              className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-muted disabled:opacity-50"
            >
              Scan a different image
            </button>
            {targetCount === 0 && (
              <span className="text-[11px] text-destructive">
                Select at least one dish (checkboxes on the dish cards) to attach.
              </span>
            )}
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
