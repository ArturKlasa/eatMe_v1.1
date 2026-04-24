'use client';

import { useState } from 'react';
import { fetchGooglePlaces } from './actions/places';
import type { GooglePlacesResult } from './actions/places';

type Phase = 'idle' | 'loading' | 'done' | 'error';

export function PlacesImportTab() {
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [radius, setRadius] = useState('1000');
  const [maxRows, setMaxRows] = useState('200');
  const [phase, setPhase] = useState<Phase>('idle');
  const [result, setResult] = useState<GooglePlacesResult | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPhase('loading');
    setResult(null);
    setErrorMsg('');

    const res = await fetchGooglePlaces({
      lat: Number(lat),
      lng: Number(lng),
      radius: Number(radius),
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
        className="space-y-3"
      >
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="places-lat" className={labelClass}>
              Latitude
            </label>
            <input
              id="places-lat"
              type="number"
              step="any"
              value={lat}
              onChange={e => setLat(e.target.value)}
              placeholder="40.7128"
              required
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="places-lng" className={labelClass}>
              Longitude
            </label>
            <input
              id="places-lng"
              type="number"
              step="any"
              value={lng}
              onChange={e => setLng(e.target.value)}
              placeholder="-74.0060"
              required
              className={inputClass}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="places-radius" className={labelClass}>
              Radius (m)
            </label>
            <input
              id="places-radius"
              type="number"
              min="50"
              max="50000"
              value={radius}
              onChange={e => setRadius(e.target.value)}
              required
              className={inputClass}
            />
          </div>
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
        </div>

        <button
          type="submit"
          disabled={phase === 'loading'}
          className="w-full rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {phase === 'loading' ? 'Fetching…' : 'Search & Import'}
        </button>
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
        <div className="rounded-md bg-green-50 border border-green-200 p-3 text-sm space-y-1">
          <p className="font-medium text-green-800">Import complete</p>
          <p className="text-green-700">
            {result.total_fetched} fetched · {result.total_inserted} inserted ·{' '}
            {result.total_skipped} skipped (duplicates)
          </p>
          <a href="/restaurants" className="text-green-700 underline text-xs">
            View restaurants →
          </a>
        </div>
      )}
    </div>
  );
}
