'use client';

import { useState, useRef } from 'react';
import type { ImportCsvResult } from '@/app/api/admin/import-csv/route';

type Phase = 'idle' | 'parsing' | 'uploading' | 'done' | 'error';

export function CsvImportTab() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [result, setResult] = useState<ImportCsvResult | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  async function handleFile(file: File) {
    setPhase('parsing');
    setResult(null);
    setErrorMsg('');

    try {
      const text = await file.text();
      const Papa = (await import('papaparse')).default;
      const parsed = Papa.parse<Record<string, string>>(text, {
        header: true,
        skipEmptyLines: true,
        transformHeader: h => h.trim().toLowerCase().replace(/\s+/g, '_'),
      });

      setPhase('uploading');
      const res = await fetch('/api/admin/import-csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: parsed.data }),
      });

      const json = (await res.json()) as { ok: boolean; data?: ImportCsvResult; error?: string };
      if (!res.ok || !json.ok) {
        setErrorMsg(json.error ?? 'Import failed');
        setPhase('error');
        return;
      }

      setResult(json.data!);
      setPhase('done');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unexpected error');
      setPhase('error');
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file).catch(() => {});
  }

  function handleReset() {
    setPhase('idle');
    setResult(null);
    setErrorMsg('');
    if (inputRef.current) inputRef.current.value = '';
  }

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="csv-file-input" className="block text-sm font-medium mb-1">
          Select CSV file
        </label>
        <input
          id="csv-file-input"
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          onChange={handleChange}
          disabled={phase === 'parsing' || phase === 'uploading'}
          className="block w-full text-sm text-foreground file:mr-4 file:py-2 file:px-3 file:rounded file:border-0 file:bg-muted file:text-sm file:cursor-pointer disabled:opacity-50"
        />
      </div>

      {(phase === 'parsing' || phase === 'uploading') && (
        <p className="text-sm text-muted-foreground">
          {phase === 'parsing' ? 'Parsing CSV…' : 'Uploading rows…'}
        </p>
      )}

      {phase === 'error' && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
          {errorMsg}
          <button type="button" onClick={handleReset} className="ml-3 underline text-xs">
            Reset
          </button>
        </div>
      )}

      {phase === 'done' && result && (
        <div className="space-y-3">
          <div className="rounded-md bg-green-50 border border-green-200 p-3 text-sm space-y-1">
            <p className="font-medium text-green-800">Import complete</p>
            <p className="text-green-700">
              {result.total_inserted} inserted · {result.total_skipped} skipped ·{' '}
              {result.total_flagged} flagged as possible duplicates
            </p>
            {result.errors.length > 0 && (
              <p className="text-amber-700">{result.errors.length} row(s) had errors</p>
            )}
          </div>

          {result.total_flagged > 0 && (
            <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-sm">
              <p className="font-medium text-amber-800">Possible duplicates</p>
              <ul className="mt-1 space-y-0.5 text-amber-700">
                {result.inserted
                  .filter(r => r.possible_duplicate)
                  .map(r => (
                    <li key={r.id}>
                      <a href={`/restaurants/${r.id}`} className="underline">
                        Row {r.index + 1}
                      </a>
                    </li>
                  ))}
              </ul>
            </div>
          )}

          {result.errors.length > 0 && (
            <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm">
              <p className="font-medium text-red-800">Row errors</p>
              <ul className="mt-1 space-y-0.5 text-red-700 text-xs">
                {result.errors.map((e, i) => (
                  <li key={i}>
                    Row {e.index + 1} · {e.field}: {e.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <button
            type="button"
            onClick={handleReset}
            className="text-sm underline text-muted-foreground"
          >
            Import another file
          </button>
        </div>
      )}
    </div>
  );
}
