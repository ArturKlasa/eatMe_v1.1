'use client';

import { useState } from 'react';
import Link from 'next/link';
import { fetchGooglePlaces } from './actions/places';
import type { GooglePlacesResult } from './actions/places';
import { ImportAreaSelector, type AreaSelection } from './ImportAreaSelector';

type Phase = 'idle' | 'loading' | 'done' | 'error';

export function PlacesImportTab() {
  const [area, setArea] = useState<AreaSelection | null>(null);
  const [maxRows, setMaxRows] = useState('200');
  const [phase, setPhase] = useState<Phase>('idle');
  const [result, setResult] = useState<GooglePlacesResult | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!area) {
      setErrorMsg('Pick an area on the map first');
      setPhase('error');
      return;
    }

    setPhase('loading');
    setResult(null);
    setErrorMsg('');

    const res = await fetchGooglePlaces({
      lat: area.lat,
      lng: area.lng,
      radius: area.radius,
      maxRows: Number(maxRows),
    });

    if (!res.ok) {
      setErrorMsg(res.formError ?? 'Import failed');
      setPhase('error');
      return;
    }

    setResult(res.data);
    setPhase('done');
  }

  function handleReset() {
    setPhase('idle');
    setResult(null);
    setErrorMsg('');
  }

  const inputClass =
    'w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring';
  const labelClass = 'block text-sm font-medium mb-1';

  return (
    <div className="space-y-4">
      <form
        onSubmit={e => {
          handleSubmit(e).catch(() => {});
        }}
        className="space-y-4"
      >
        <ImportAreaSelector onAreaSelect={setArea} />

        <div className="grid grid-cols-2 gap-3 items-end">
          <div>
            <label htmlFor="places-max" className={labelClass}>
              Max results
            </label>
            <input
              id="places-max"
              type="number"
              min="1"
              max="1000"
              value={maxRows}
              onChange={e => setMaxRows(e.target.value)}
              required
              className={inputClass}
            />
          </div>
          <button
            type="submit"
            disabled={phase === 'loading' || !area}
            className="rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {phase === 'loading' ? 'Fetching…' : 'Search & Import'}
          </button>
        </div>
      </form>

      {phase === 'error' && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
          {errorMsg}
          <button type="button" onClick={handleReset} className="ml-3 underline text-xs">
            Reset
          </button>
        </div>
      )}

      {phase === 'done' && result && (
        <div
          className={`rounded-md border p-3 text-sm space-y-2 ${
            result.total_errors > 0
              ? 'bg-yellow-50 border-yellow-200'
              : 'bg-green-50 border-green-200'
          }`}
        >
          <p
            className={`font-medium ${
              result.total_errors > 0 ? 'text-yellow-800' : 'text-green-800'
            }`}
          >
            {result.total_errors > 0 ? 'Import finished with errors' : 'Import complete'}
          </p>
          <p className={result.total_errors > 0 ? 'text-yellow-700' : 'text-green-700'}>
            {result.total_fetched} fetched · {result.total_inserted} inserted ·{' '}
            {result.total_skipped} skipped (duplicates) · {result.total_errors} failed
          </p>

          {result.error_samples.length > 0 && (
            <div className="rounded border border-yellow-300 bg-yellow-100/50 p-2">
              <p className="font-medium text-yellow-900 text-xs mb-1">
                Sample failures (showing {result.error_samples.length} of {result.total_errors}):
              </p>
              <ul className="space-y-0.5 text-xs text-yellow-900">
                {result.error_samples.map((err, i) => (
                  <li key={i}>
                    <span className="font-medium">{err.name}</span>: {err.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <Link
            href="/restaurants"
            className={`underline text-xs ${
              result.total_errors > 0 ? 'text-yellow-700' : 'text-green-700'
            }`}
          >
            View restaurants →
          </Link>
        </div>
      )}
    </div>
  );
}
