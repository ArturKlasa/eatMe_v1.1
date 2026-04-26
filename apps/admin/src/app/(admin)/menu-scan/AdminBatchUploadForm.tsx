'use client';

import { useState, useRef, useCallback, useReducer } from 'react';
import { supabase } from '@/lib/supabase/browser';
import { uploadMenuScanPage, type StorageClient } from '@/lib/upload';
import { adminCreateMenuScanJob, skipMenuScanRestaurant } from './actions/menuScan';

export type RestaurantOption = { id: string; name: string; city: string | null };

interface Props {
  restaurantOptions: RestaurantOption[];
}

function mapsUrlFor(r: RestaurantOption): string {
  const q = [r.name, r.city].filter(Boolean).join(' ');
  return `https://www.google.com/maps/search/${encodeURIComponent(q)}`;
}

type FileEntry = {
  file: File;
  restaurantId: string;
};

type JobStatus = { jobId: string; status: 'pending' | 'done' | 'error'; error?: string };

type State = {
  entries: FileEntry[];
  defaultRestaurantId: string;
  options: RestaurantOption[];
  phase: 'idle' | 'uploading' | 'creating' | 'done' | 'error';
  jobStatuses: JobStatus[];
  errorMessage: string | null;
};

type Action =
  | { type: 'SET_DEFAULT_RESTAURANT'; restaurantId: string }
  | { type: 'REMOVE_OPTION'; restaurantId: string }
  | { type: 'ADD_FILES'; files: File[]; defaultRestaurantId: string }
  | { type: 'REMOVE_ENTRY'; index: number }
  | { type: 'SET_ENTRY_RESTAURANT'; index: number; restaurantId: string }
  | { type: 'SET_PHASE'; phase: State['phase'] }
  | { type: 'SET_ERROR'; message: string }
  | { type: 'SET_JOB_STATUSES'; statuses: JobStatus[] }
  | { type: 'UPDATE_JOB_STATUS'; jobId: string; status: JobStatus['status']; error?: string }
  | { type: 'RESET' };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET_DEFAULT_RESTAURANT':
      return { ...state, defaultRestaurantId: action.restaurantId };
    case 'REMOVE_OPTION': {
      const nextOptions = state.options.filter(o => o.id !== action.restaurantId);
      const nextDefault =
        state.defaultRestaurantId === action.restaurantId
          ? (nextOptions[0]?.id ?? '')
          : state.defaultRestaurantId;
      const nextEntries = state.entries.map(e =>
        e.restaurantId === action.restaurantId ? { ...e, restaurantId: nextDefault } : e
      );
      return {
        ...state,
        options: nextOptions,
        defaultRestaurantId: nextDefault,
        entries: nextEntries,
      };
    }
    case 'ADD_FILES': {
      const newEntries = action.files.map(f => ({
        file: f,
        restaurantId: action.defaultRestaurantId,
      }));
      const combined = [...state.entries, ...newEntries].slice(0, 20);
      return { ...state, entries: combined };
    }
    case 'REMOVE_ENTRY':
      return { ...state, entries: state.entries.filter((_, i) => i !== action.index) };
    case 'SET_ENTRY_RESTAURANT':
      return {
        ...state,
        entries: state.entries.map((e, i) =>
          i === action.index ? { ...e, restaurantId: action.restaurantId } : e
        ),
      };
    case 'SET_PHASE':
      return { ...state, phase: action.phase };
    case 'SET_ERROR':
      return { ...state, phase: 'error', errorMessage: action.message };
    case 'SET_JOB_STATUSES':
      return { ...state, jobStatuses: action.statuses };
    case 'UPDATE_JOB_STATUS':
      return {
        ...state,
        jobStatuses: state.jobStatuses.map(s =>
          s.jobId === action.jobId ? { ...s, status: action.status, error: action.error } : s
        ),
      };
    case 'RESET':
      return {
        ...state,
        entries: [],
        phase: 'idle',
        jobStatuses: [],
        errorMessage: null,
      };
    default:
      return state;
  }
}

const ACCEPTED_TYPES = new Set(['image/jpeg', 'image/png', 'application/pdf']);
const ACCEPTED_EXT = /\.(jpe?g|png|pdf)$/i;

function isAccepted(file: File): boolean {
  return ACCEPTED_TYPES.has(file.type) || ACCEPTED_EXT.test(file.name);
}

async function rasterisePdf(file: File): Promise<File[]> {
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString();

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pages: File[] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) continue;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await page.render({ canvasContext: ctx as unknown as any, viewport, canvas }).promise;

    const blob = await new Promise<Blob | null>(resolve =>
      canvas.toBlob(resolve, 'image/jpeg', 0.85)
    );
    if (!blob) continue;

    const pageName = `${file.name.replace(/\.pdf$/i, '')}-page-${pageNum}.jpg`;
    pages.push(new File([blob], pageName, { type: 'image/jpeg' }));
  }

  return pages;
}

export function AdminBatchUploadForm({ restaurantOptions }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const initialRestaurantId = restaurantOptions[0]?.id ?? '';

  const [state, dispatch] = useReducer(reducer, {
    entries: [],
    defaultRestaurantId: initialRestaurantId,
    options: restaurantOptions,
    phase: 'idle',
    jobStatuses: [],
    errorMessage: null,
  });

  const [pdfLoading, setPdfLoading] = useState(false);
  const [skipping, setSkipping] = useState(false);

  const defaultRestaurant = state.options.find(r => r.id === state.defaultRestaurantId) ?? null;

  const handleSkipDefault = useCallback(async () => {
    if (!defaultRestaurant) return;
    const confirmed = window.confirm(
      `Mark "${defaultRestaurant.name}" as not needing a menu scan? It will be removed from the list.`
    );
    if (!confirmed) return;
    setSkipping(true);
    try {
      const result = await skipMenuScanRestaurant(defaultRestaurant.id);
      if (!result.ok) {
        dispatch({ type: 'SET_ERROR', message: result.formError ?? 'Failed to skip restaurant' });
        return;
      }
      dispatch({ type: 'REMOVE_OPTION', restaurantId: defaultRestaurant.id });
    } finally {
      setSkipping(false);
    }
  }, [defaultRestaurant]);

  const handleFiles = useCallback(
    async (incoming: FileList | null) => {
      if (!incoming) return;
      const filesArray = Array.from(incoming);
      const normalFiles: File[] = [];

      for (const f of filesArray) {
        if (!isAccepted(f)) continue;
        if (f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')) {
          setPdfLoading(true);
          try {
            const rasterised = await rasterisePdf(f);
            dispatch({
              type: 'ADD_FILES',
              files: rasterised,
              defaultRestaurantId: state.defaultRestaurantId,
            });
          } catch (err) {
            console.error('PDF rasterisation failed', err);
          } finally {
            setPdfLoading(false);
          }
        } else {
          normalFiles.push(f);
        }
      }

      if (normalFiles.length > 0) {
        dispatch({
          type: 'ADD_FILES',
          files: normalFiles,
          defaultRestaurantId: state.defaultRestaurantId,
        });
      }
    },
    [state.defaultRestaurantId]
  );

  const handleSubmit = async () => {
    if (state.entries.length === 0) return;
    if (!state.defaultRestaurantId) return;

    dispatch({ type: 'SET_PHASE', phase: 'uploading' });

    // Group entries by restaurant_id
    const groups = new Map<string, FileEntry[]>();
    for (const entry of state.entries) {
      const rid = entry.restaurantId || state.defaultRestaurantId;
      if (!groups.has(rid)) groups.set(rid, []);
      groups.get(rid)!.push(entry);
    }

    const initialStatuses: JobStatus[] = Array.from(groups.keys()).map(rid => ({
      jobId: rid,
      status: 'pending',
    }));
    dispatch({ type: 'SET_JOB_STATUSES', statuses: initialStatuses });

    dispatch({ type: 'SET_PHASE', phase: 'creating' });

    for (const [restaurantId, entries] of groups) {
      try {
        const images: { bucket: 'menu-scan-uploads'; path: string; page: number }[] = [];

        for (let i = 0; i < entries.length; i++) {
          const result = await uploadMenuScanPage(
            restaurantId,
            entries[i].file,
            i + 1,
            supabase as unknown as StorageClient
          );
          images.push(result);
        }

        const result = await adminCreateMenuScanJob(restaurantId, { images });

        if (!result.ok) {
          dispatch({
            type: 'UPDATE_JOB_STATUS',
            jobId: restaurantId,
            status: 'error',
            error: result.formError ?? 'Failed to create job',
          });
        } else {
          dispatch({
            type: 'UPDATE_JOB_STATUS',
            jobId: restaurantId,
            status: 'done',
          });
        }
      } catch (err) {
        dispatch({
          type: 'UPDATE_JOB_STATUS',
          jobId: restaurantId,
          status: 'error',
          error: err instanceof Error ? err.message : 'Upload failed',
        });
      }
    }

    dispatch({ type: 'SET_PHASE', phase: 'done' });
  };

  const isProcessing = state.phase === 'uploading' || state.phase === 'creating';

  return (
    <section className="border border-border rounded-lg p-6 mb-8 space-y-4">
      <h2 className="text-base font-semibold">Batch Upload Menu Scan</h2>

      {/* Default restaurant picker */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <label htmlFor="default-restaurant" className="text-sm font-medium shrink-0">
            Default restaurant
          </label>
          <select
            id="default-restaurant"
            value={state.defaultRestaurantId}
            onChange={e =>
              dispatch({ type: 'SET_DEFAULT_RESTAURANT', restaurantId: e.target.value })
            }
            className="flex-1 rounded border border-border px-2 py-1.5 text-sm bg-background"
            disabled={isProcessing}
          >
            <option value="">-- select --</option>
            {state.options.map(r => (
              <option key={r.id} value={r.id}>
                {r.name}
                {r.city ? ` — ${r.city}` : ''}
              </option>
            ))}
          </select>
        </div>
        {defaultRestaurant && (
          <div className="flex items-center gap-4 pl-[calc(theme(spacing.3)+10ch)] -mt-1 text-xs">
            <a
              href={mapsUrlFor(defaultRestaurant)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground underline underline-offset-2"
              title="View on Google Maps"
            >
              Google Maps ↗
            </a>
            <button
              type="button"
              onClick={() => void handleSkipDefault()}
              disabled={skipping || isProcessing}
              className="text-muted-foreground hover:text-destructive underline underline-offset-2 disabled:opacity-50"
              title="This restaurant doesn't need a menu — remove it from the list"
            >
              {skipping ? 'Skipping…' : 'Skip'}
            </button>
          </div>
        )}
      </div>

      {/* Drop zone */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Drop zone for menu files. Press Enter or Space to open file picker."
        aria-disabled={isProcessing}
        onDrop={e => {
          e.preventDefault();
          void handleFiles(e.dataTransfer.files);
        }}
        onDragOver={e => e.preventDefault()}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            fileInputRef.current?.click();
          }
        }}
        onClick={() => !isProcessing && fileInputRef.current?.click()}
        className={[
          'flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-8 text-sm transition-colors cursor-pointer select-none',
          isProcessing ? 'pointer-events-none opacity-50' : 'border-border hover:border-primary/50',
        ].join(' ')}
      >
        <p className="font-medium">Drop files here or click to browse</p>
        <p className="text-muted-foreground text-xs">JPEG, PNG, PDF — up to 20 pages total</p>
        {pdfLoading && (
          <p className="text-xs text-muted-foreground animate-pulse">Rasterising PDF…</p>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".jpg,.jpeg,.png,.pdf"
        multiple
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={e => void handleFiles(e.target.files)}
        disabled={isProcessing}
      />

      {/* File list with per-file restaurant override */}
      {state.entries.length > 0 && (
        <ul className="space-y-2" aria-label="Selected files">
          {state.entries.map((entry, i) => (
            <li
              key={`${entry.file.name}-${i}`}
              className="flex items-center gap-2 rounded border border-border px-3 py-2 text-sm"
            >
              <span className="truncate max-w-[200px] shrink-0">{entry.file.name}</span>
              <select
                aria-label={`Restaurant for ${entry.file.name}`}
                value={entry.restaurantId}
                onChange={e =>
                  dispatch({ type: 'SET_ENTRY_RESTAURANT', index: i, restaurantId: e.target.value })
                }
                className="flex-1 rounded border border-border px-1.5 py-1 text-xs bg-background"
                disabled={isProcessing}
              >
                {state.options.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                    {r.city ? ` — ${r.city}` : ''}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => dispatch({ type: 'REMOVE_ENTRY', index: i })}
                aria-label={`Remove ${entry.file.name}`}
                className="text-muted-foreground hover:text-destructive shrink-0"
                disabled={isProcessing}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Job status list after submit */}
      {state.jobStatuses.length > 0 && (
        <ul className="space-y-1 text-sm">
          {state.jobStatuses.map(s => (
            <li key={s.jobId} className="flex items-center gap-2">
              <span
                className={
                  s.status === 'done'
                    ? 'text-green-600'
                    : s.status === 'error'
                      ? 'text-destructive'
                      : 'text-muted-foreground'
                }
              >
                {s.status === 'done' ? 'Created' : s.status === 'error' ? 'Failed' : 'Pending'}
              </span>
              <span className="font-mono text-xs text-muted-foreground truncate">{s.jobId}</span>
              {s.error && <span className="text-xs text-destructive">{s.error}</span>}
            </li>
          ))}
        </ul>
      )}

      {state.phase === 'error' && state.errorMessage && (
        <p role="alert" className="text-sm text-destructive">
          {state.errorMessage}
        </p>
      )}

      {isProcessing && (
        <p aria-live="polite" className="text-sm text-muted-foreground">
          {state.phase === 'uploading' ? 'Uploading images…' : 'Creating scan jobs…'}
        </p>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={state.entries.length === 0 || isProcessing || !state.defaultRestaurantId}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {isProcessing
            ? 'Processing…'
            : `Scan ${state.entries.length} file${state.entries.length !== 1 ? 's' : ''}`}
        </button>
        {state.phase === 'done' && (
          <button
            type="button"
            onClick={() => dispatch({ type: 'RESET' })}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            Upload more
          </button>
        )}
      </div>
    </section>
  );
}
