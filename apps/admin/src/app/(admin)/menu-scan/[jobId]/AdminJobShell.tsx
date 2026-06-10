'use client';

import { useEffect, useMemo, useReducer, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/browser';
import { replayMenuScan, adminUpdateJobStatus } from '../actions/menuScan';
import type {
  AdminMenuScanJobDetail,
  MenuScanImageUrl,
  MenuScanReviewContext,
  DishCategoryMatch,
} from '@/lib/auth/dal';
import { ReviewDishEditor, type ExtractedDish } from './ReviewDishEditor';
import { SourceImageStrip } from './SourceImageStrip';

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  processing: 'bg-blue-100 text-blue-800',
  needs_review: 'bg-orange-100 text-orange-800',
  completed: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
};

function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-700';
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}
    >
      {status}
    </span>
  );
}

// Sticky source-image preview shown beside the dish list. `page` is synced by
// AdminJobShell from the focused dish's source_image_index, so the operator can
// eyeball each dish against the page it came from. The in-column image stays
// fit-to-width (the narrow column can't show fine print); clicking it opens a
// full-screen lightbox — same overlay the thumbnail strip uses.
//
// `sticky` lives on the <aside> grid item (not an inner div) on purpose: the
// grid is `items-start`, so the aside shrinks to its content. Putting sticky on
// a child would leave it no room to slide. The aside's containing block is the
// (tall) grid row, so it pins correctly.
function ReviewSourcePanel({
  imageUrls,
  page,
  onPage,
}: {
  imageUrls: MenuScanImageUrl[];
  page: number;
  onPage: (p: number) => void;
}) {
  const [lightbox, setLightbox] = useState(false);
  const img = imageUrls[page];

  // Esc closes the lightbox. Window listener so it works regardless of focus.
  useEffect(() => {
    if (!lightbox) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setLightbox(false);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [lightbox]);

  return (
    <aside className="hidden self-start lg:sticky lg:top-4 lg:block">
      <div className="space-y-2 rounded-lg border border-border p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-muted-foreground">
            Source · page {page + 1} / {imageUrls.length}
          </span>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setLightbox(true)}
              disabled={!img}
              className="rounded border border-border px-2 py-0.5 text-xs hover:bg-muted disabled:opacity-40"
              title="Open full size"
            >
              Enlarge
            </button>
            <button
              type="button"
              onClick={() => onPage(Math.max(0, page - 1))}
              disabled={page === 0}
              className="rounded border border-border px-2 py-0.5 text-sm hover:bg-muted disabled:opacity-40"
              aria-label="Previous page"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => onPage(Math.min(imageUrls.length - 1, page + 1))}
              disabled={page >= imageUrls.length - 1}
              className="rounded border border-border px-2 py-0.5 text-sm hover:bg-muted disabled:opacity-40"
              aria-label="Next page"
            >
              ›
            </button>
          </div>
        </div>
        <div className="max-h-[calc(100vh-9rem)] overflow-auto rounded border border-border bg-muted/30">
          {img ? (
            <button
              type="button"
              onClick={() => setLightbox(true)}
              className="block w-full cursor-zoom-in"
              aria-label="Enlarge source page"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.url}
                alt={`Source page ${page + 1}`}
                loading="lazy"
                className="w-full"
              />
            </button>
          ) : (
            <p className="p-4 text-xs text-muted-foreground">No source image for this page.</p>
          )}
        </div>
        <p className="text-[10px] text-muted-foreground">
          Follows the focused dish · click to enlarge.
        </p>
      </div>

      {lightbox && img && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Source page (full size)"
          onClick={() => setLightbox(false)}
          className="fixed inset-0 z-50 flex cursor-zoom-out items-center justify-center bg-black/80 p-6"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={img.url}
            alt={`Source page ${page + 1} (full size)`}
            className="max-h-full max-w-full object-contain"
          />
        </div>
      )}
    </aside>
  );
}

type JobRow = {
  id: string;
  restaurant_id: string;
  restaurant_name: string | null;
  restaurant_country_code: string | null;
  restaurant_currency_code: string;
  status: string;
  attempts: number;
  last_error: string | null;
  result_json: unknown;
  input: unknown;
  locked_until: string | null;
  saved_dish_ids: unknown;
  saved_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type State = {
  job: JobRow;
  replayLoading: boolean;
  replayError: string | null;
  replayNewJobId: string | null;
  statusUpdateLoading: boolean;
  statusUpdateError: string | null;
};

type Action =
  | { type: 'JOB_UPDATED'; job: Partial<JobRow> }
  | { type: 'REPLAY_START' }
  | { type: 'REPLAY_SUCCESS'; newJobId: string }
  | { type: 'REPLAY_ERROR'; message: string }
  | { type: 'STATUS_UPDATE_START' }
  | { type: 'STATUS_UPDATE_SUCCESS'; status: string }
  | { type: 'STATUS_UPDATE_ERROR'; message: string };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'JOB_UPDATED':
      return { ...state, job: { ...state.job, ...action.job } };
    case 'REPLAY_START':
      return { ...state, replayLoading: true, replayError: null, replayNewJobId: null };
    case 'REPLAY_SUCCESS':
      return { ...state, replayLoading: false, replayNewJobId: action.newJobId };
    case 'REPLAY_ERROR':
      return { ...state, replayLoading: false, replayError: action.message };
    case 'STATUS_UPDATE_START':
      return { ...state, statusUpdateLoading: true, statusUpdateError: null };
    case 'STATUS_UPDATE_SUCCESS':
      return {
        ...state,
        statusUpdateLoading: false,
        job: { ...state.job, status: action.status },
      };
    case 'STATUS_UPDATE_ERROR':
      return { ...state, statusUpdateLoading: false, statusUpdateError: action.message };
    default:
      return state;
  }
}

interface Props {
  job: AdminMenuScanJobDetail;
  reviewContext: MenuScanReviewContext | null;
  dishCategoryMatches: DishCategoryMatch[];
  imageUrls: MenuScanImageUrl[];
}

export function AdminJobShell({
  job: initialJob,
  reviewContext,
  dishCategoryMatches,
  imageUrls,
}: Props) {
  const [state, dispatch] = useReducer(reducer, {
    job: initialJob,
    replayLoading: false,
    replayError: null,
    replayNewJobId: null,
    statusUpdateLoading: false,
    statusUpdateError: null,
  });

  const { job } = state;

  // Source page shown in the synced preview panel — updated as the operator
  // focuses a dish (each dish carries its source_image_index).
  const [activePage, setActivePage] = useState(0);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel(`admin-scan-job-${job.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'menu_scan_jobs',
          filter: `id=eq.${job.id}`,
        },
        payload => {
          dispatch({ type: 'JOB_UPDATED', job: payload.new as Partial<JobRow> });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [job.id]);

  const handleReplay = async () => {
    dispatch({ type: 'REPLAY_START' });
    const result = await replayMenuScan(job.id);
    if (result.ok) {
      dispatch({ type: 'REPLAY_SUCCESS', newJobId: result.data.newJobId });
    } else {
      dispatch({ type: 'REPLAY_ERROR', message: result.formError ?? 'Replay failed' });
    }
  };

  const handleStatusFlip = async (newStatus: 'needs_review' | 'failed') => {
    dispatch({ type: 'STATUS_UPDATE_START' });
    const result = await adminUpdateJobStatus(job.id, { status: newStatus });
    if (result.ok) {
      dispatch({ type: 'STATUS_UPDATE_SUCCESS', status: newStatus });
    } else {
      dispatch({
        type: 'STATUS_UPDATE_ERROR',
        message: result.formError ?? 'Update failed',
      });
    }
  };

  // Parse result_json for dish count and confidence
  const resultJson = job.result_json as {
    dishes?: ExtractedDish[];
    detected_language?: string | null;
    // 1-based page numbers the worker couldn't extract (failed) or whose output
    // hit the token ceiling (truncated). Absent on jobs scanned before the
    // worker started recording them (2026-06-09).
    failed_pages?: number[];
    truncated_pages?: number[];
  } | null;
  const dishes = resultJson?.dishes ?? null;
  const detectedLanguage = resultJson?.detected_language ?? null;
  const failedPages = resultJson?.failed_pages ?? [];
  const truncatedPages = resultJson?.truncated_pages ?? [];

  // Per-page dish counts keyed by source_image_index (0-based array position
  // in input.images, matches what the worker passes to the AI). Drives the
  // green/yellow badge on the source-image strip — yellow == 0 dishes, the
  // diagnostic that flags partial-extraction failures.
  const dishCountsByIndex = useMemo(() => {
    const map = new Map<number, number>();
    for (const d of dishes ?? []) {
      const idx = d.source_image_index;
      if (typeof idx !== 'number') continue;
      map.set(idx, (map.get(idx) ?? 0) + 1);
    }
    return map;
  }, [dishes]);
  const savedDishIds = Array.isArray(job.saved_dish_ids) ? (job.saved_dish_ids as string[]) : null;
  const showEditor =
    job.status === 'needs_review' && dishes !== null && dishes.length > 0 && reviewContext !== null;

  return (
    <div className="space-y-6">
      {/* Status panel */}
      <div className="rounded-lg border border-border p-6 space-y-4">
        <h2 className="text-sm font-semibold">Status</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Current status</p>
            <StatusBadge status={job.status} />
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Attempts</p>
            <p className="font-mono">{job.attempts}</p>
          </div>
          {job.restaurant_name && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">Restaurant</p>
              <a
                href={`/restaurants/${job.restaurant_id}`}
                className="text-primary hover:underline text-sm"
              >
                {job.restaurant_name}
              </a>
            </div>
          )}
          {job.created_at && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">Created</p>
              {/* SSR uses system locale, client uses browser locale — same Date,
                  different display. suppressHydrationWarning is the documented
                  React fix for this. */}
              <p className="text-xs" suppressHydrationWarning>
                {new Date(job.created_at).toLocaleString()}
              </p>
            </div>
          )}
          {job.locked_until && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">Locked until</p>
              <p className="text-xs font-mono">{job.locked_until}</p>
            </div>
          )}
        </div>

        {job.last_error && (
          <div>
            <p className="text-xs text-muted-foreground mb-1">Last error</p>
            <pre className="text-xs bg-destructive/5 border border-destructive/20 rounded p-3 whitespace-pre-wrap break-all">
              {job.last_error}
            </pre>
          </div>
        )}

        {/* Status flip buttons — only for needs_review or failed */}
        {(job.status === 'needs_review' || job.status === 'failed') && (
          <div className="flex gap-2 flex-wrap pt-2">
            <p className="text-xs text-muted-foreground self-center">Flip status:</p>
            {job.status !== 'needs_review' && (
              <button
                type="button"
                onClick={() => void handleStatusFlip('needs_review')}
                disabled={state.statusUpdateLoading}
                className="rounded border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50"
              >
                Set needs_review
              </button>
            )}
            {job.status !== 'failed' && (
              <button
                type="button"
                onClick={() => void handleStatusFlip('failed')}
                disabled={state.statusUpdateLoading}
                className="rounded border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50"
              >
                Set failed
              </button>
            )}
          </div>
        )}

        {state.statusUpdateError && (
          <p className="text-xs text-destructive">{state.statusUpdateError}</p>
        )}
      </div>

      {/* Page-health warning — the worker completes a job even when individual
          pages fail or truncate (partial results beat none), so missing pages
          must be called out here or the operator reads a half-empty scan as a
          clean one. */}
      {(failedPages.length > 0 || truncatedPages.length > 0) && (
        <div
          role="alert"
          className="rounded-lg border border-yellow-300 bg-yellow-50 p-4 text-sm text-yellow-900 dark:border-yellow-900/40 dark:bg-yellow-900/10 dark:text-yellow-200"
        >
          <p className="font-semibold">⚠ Some pages did not extract fully</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs">
            {failedPages.length > 0 && (
              <li>
                Page{failedPages.length === 1 ? '' : 's'} {failedPages.join(', ')} failed completely
                — no dishes were read from {failedPages.length === 1 ? 'it' : 'them'}.
              </li>
            )}
            {truncatedPages.length > 0 && (
              <li>
                Page{truncatedPages.length === 1 ? '' : 's'} {truncatedPages.join(', ')} hit the
                output limit — the last dishes on{' '}
                {truncatedPages.length === 1 ? 'that page' : 'those pages'} may be missing.
              </li>
            )}
          </ul>
          <p className="mt-1 text-xs">
            Use Replay below to re-run the scan, or compare against the source images before saving.
          </p>
        </div>
      )}

      {/* Source-image strip — visible for all statuses so admin can see what
          was scanned (and which pages came back empty). Sits above the review
          editor so the diagnostic context is established before the work. */}
      <div className="rounded-lg border border-border p-6 space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold">Source images</h2>
          <span className="text-xs text-muted-foreground">
            {imageUrls.length} page{imageUrls.length === 1 ? '' : 's'} uploaded
          </span>
        </div>
        <SourceImageStrip images={imageUrls} dishCountsByIndex={dishCountsByIndex} />
      </div>

      {/* Review editor + synced source-image panel */}
      {showEditor && dishes && reviewContext && (
        <div className="grid items-start gap-4 lg:grid-cols-[1fr_minmax(300px,400px)]">
          <div className="min-w-0 rounded-lg border border-border p-6">
            <ReviewDishEditor
              jobId={job.id}
              initialDishes={dishes}
              countryCode={job.restaurant_country_code}
              currencyCode={job.restaurant_currency_code}
              detectedLanguage={detectedLanguage}
              existingCategories={reviewContext.existingCategories}
              canonicalCategories={reviewContext.canonicalCategories}
              dishCategories={reviewContext.dishCategories}
              dishCategoryMatches={dishCategoryMatches}
              onActiveImageIndexChange={p =>
                setActivePage(Math.min(Math.max(0, p), imageUrls.length - 1))
              }
            />
          </div>
          {imageUrls.length > 0 && (
            <ReviewSourcePanel imageUrls={imageUrls} page={activePage} onPage={setActivePage} />
          )}
        </div>
      )}

      {/* Completed summary */}
      {job.status === 'completed' && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-6 space-y-2 dark:border-green-900/40 dark:bg-green-900/10">
          <h2 className="text-sm font-semibold text-green-900 dark:text-green-200">
            Imported successfully
          </h2>
          <p className="text-sm text-green-900/80 dark:text-green-200/80" suppressHydrationWarning>
            {savedDishIds
              ? `${savedDishIds.length} dish${savedDishIds.length === 1 ? '' : 'es'}`
              : 'Dishes'}{' '}
            saved as drafts
            {job.saved_at && ` on ${new Date(job.saved_at).toLocaleString()}`}
            {job.restaurant_id && (
              <>
                {' '}
                — see them in{' '}
                <Link href={`/restaurants/${job.restaurant_id}`} className="underline font-medium">
                  the restaurant
                </Link>
                .
              </>
            )}
          </p>
        </div>
      )}

      {/* Raw JSON (debug) */}
      <details className="rounded-lg border border-border p-4">
        <summary className="text-sm font-semibold cursor-pointer select-none text-muted-foreground hover:text-foreground">
          Raw JSON (debug)
        </summary>
        <div className="mt-4 space-y-4">
          {dishes !== null && (
            <div className="flex gap-4 text-sm">
              <div>
                <span className="text-muted-foreground text-xs">Dishes extracted: </span>
                <span className="font-semibold">{dishes.length}</span>
              </div>
              {dishes.length > 0 && (
                <div>
                  <span className="text-muted-foreground text-xs">Avg confidence: </span>
                  <span className="font-semibold">
                    {(
                      dishes.reduce((sum, d) => sum + (d.confidence ?? 0), 0) / dishes.length
                    ).toFixed(2)}
                  </span>
                </div>
              )}
            </div>
          )}
          <div>
            <p className="text-xs text-muted-foreground mb-2">result_json</p>
            <pre className="text-xs bg-muted/30 rounded border border-border p-4 overflow-auto max-h-96 whitespace-pre-wrap break-all">
              {job.result_json !== null && job.result_json !== undefined
                ? JSON.stringify(job.result_json, null, 2)
                : 'null'}
            </pre>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-2">input</p>
            <pre className="text-xs bg-muted/30 rounded border border-border p-4 overflow-auto max-h-48 whitespace-pre-wrap break-all">
              {job.input !== null && job.input !== undefined
                ? JSON.stringify(job.input, null, 2)
                : 'null'}
            </pre>
          </div>
        </div>
      </details>

      {/* Replay panel */}
      <div className="rounded-lg border border-border p-6 space-y-4">
        <h2 className="text-sm font-semibold">Replay</h2>
        <p className="text-xs text-muted-foreground">
          Creates a new pending job with the same input images and fires the worker immediately. It
          runs on the current worker model.
        </p>

        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={() => void handleReplay()}
            disabled={state.replayLoading}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {state.replayLoading ? 'Replaying…' : 'Replay'}
          </button>
        </div>

        {state.replayNewJobId && (
          <p className="text-sm text-green-600">
            New job created:{' '}
            <a href={`/menu-scan/${state.replayNewJobId}`} className="font-mono underline">
              {state.replayNewJobId}
            </a>
          </p>
        )}

        {state.replayError && <p className="text-sm text-destructive">{state.replayError}</p>}
      </div>
    </div>
  );
}
