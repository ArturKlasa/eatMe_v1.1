'use client';

import { useEffect, useReducer } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/browser';
import { replayMenuScan, adminUpdateJobStatus } from '../actions/menuScan';
import type {
  AdminMenuScanJobDetail,
  MenuScanReviewContext,
  DishCategoryMatch,
} from '@/lib/auth/dal';
import { ReviewDishEditor, type ExtractedDish } from './ReviewDishEditor';

type ReplayModel = 'gpt-4o-2024-11-20' | 'gpt-4o-mini';

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

type JobRow = {
  id: string;
  restaurant_id: string;
  restaurant_name: string | null;
  restaurant_country_code: string | null;
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
  selectedModel: ReplayModel;
  replayLoading: boolean;
  replayError: string | null;
  replayNewJobId: string | null;
  statusUpdateLoading: boolean;
  statusUpdateError: string | null;
};

type Action =
  | { type: 'JOB_UPDATED'; job: Partial<JobRow> }
  | { type: 'SET_MODEL'; model: ReplayModel }
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
    case 'SET_MODEL':
      return { ...state, selectedModel: action.model };
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
}

export function AdminJobShell({ job: initialJob, reviewContext, dishCategoryMatches }: Props) {
  const [state, dispatch] = useReducer(reducer, {
    job: initialJob,
    selectedModel: 'gpt-4o-2024-11-20',
    replayLoading: false,
    replayError: null,
    replayNewJobId: null,
    statusUpdateLoading: false,
    statusUpdateError: null,
  });

  const { job } = state;

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
    const result = await replayMenuScan(job.id, { model: state.selectedModel });
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
  } | null;
  const dishes = resultJson?.dishes ?? null;
  const detectedLanguage = resultJson?.detected_language ?? null;
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
              <p className="text-xs">{new Date(job.created_at).toLocaleString()}</p>
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

      {/* Review editor */}
      {showEditor && dishes && reviewContext && (
        <div className="rounded-lg border border-border p-6">
          <ReviewDishEditor
            jobId={job.id}
            initialDishes={dishes}
            countryCode={job.restaurant_country_code}
            detectedLanguage={detectedLanguage}
            existingCategories={reviewContext.existingCategories}
            canonicalCategories={reviewContext.canonicalCategories}
            dishCategories={reviewContext.dishCategories}
            dishCategoryMatches={dishCategoryMatches}
          />
        </div>
      )}

      {/* Completed summary */}
      {job.status === 'completed' && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-6 space-y-2 dark:border-green-900/40 dark:bg-green-900/10">
          <h2 className="text-sm font-semibold text-green-900 dark:text-green-200">
            Imported successfully
          </h2>
          <p className="text-sm text-green-900/80 dark:text-green-200/80">
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
          Creates a new pending job with the same input images and fires the worker immediately.
        </p>

        <div className="flex items-center gap-3 flex-wrap">
          <label htmlFor="replay-model" className="text-sm font-medium">
            Model
          </label>
          <select
            id="replay-model"
            value={state.selectedModel}
            onChange={e => dispatch({ type: 'SET_MODEL', model: e.target.value as ReplayModel })}
            className="rounded border border-border px-2 py-1.5 text-sm bg-background"
            disabled={state.replayLoading}
          >
            <option value="gpt-4o-2024-11-20">gpt-4o-2024-11-20</option>
            <option value="gpt-4o-mini">gpt-4o-mini</option>
          </select>

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
