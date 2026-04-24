'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/browser';
import { DishReviewTable } from './DishReviewTable';
import { retryMenuScan } from '../../actions/menuScan';

type Category = { id: string; name: string; menu_id: string };
type Menu = { id: string; name: string };

interface JobRow {
  id: string;
  restaurant_id: string;
  status: string;
  result_json: unknown;
  attempts: number;
  created_at: string | null;
  last_error: string | null;
}

interface Props {
  jobId: string;
  restaurantId: string;
  initial: JobRow;
  categories: Category[];
  menus: Menu[];
}

export function ScanReviewShell({ jobId, restaurantId, initial, categories, menus }: Props) {
  const qc = useQueryClient();

  const { data: job } = useQuery<JobRow>({
    queryKey: ['scan-job', jobId],
    queryFn: async () => initial,
    initialData: initial,
    staleTime: Infinity,
  });

  useEffect(() => {
    const channel = supabase
      .channel(`scan-job-${jobId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'menu_scan_jobs',
          filter: `id=eq.${jobId}`,
        },
        payload => {
          qc.setQueryData<JobRow>(['scan-job', jobId], payload.new as JobRow);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [jobId, qc]);

  if (!job) return null;

  if (job.status === 'pending' || job.status === 'processing') {
    return (
      <div className="flex flex-col items-center py-16 gap-4">
        <div
          className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"
          aria-label="Loading"
        />
        <p className="text-muted-foreground text-sm">
          {job.status === 'pending' ? 'Waiting for worker…' : 'Scanning menu…'}
        </p>
        <p className="text-xs text-muted-foreground">This usually takes less than 60 seconds.</p>
      </div>
    );
  }

  if (job.status === 'needs_review') {
    const result = job.result_json as { dishes?: unknown[] } | null;
    const extractedDishes = result?.dishes ?? [];

    return (
      <DishReviewTable
        jobId={jobId}
        restaurantId={restaurantId}
        extractedDishes={
          extractedDishes as Parameters<typeof DishReviewTable>[0]['extractedDishes']
        }
        categories={categories}
        menus={menus}
      />
    );
  }

  if (job.status === 'completed') {
    return (
      <div className="rounded-lg border border-border bg-card p-6 text-center space-y-4">
        <p className="text-lg font-medium text-green-600">Scan confirmed!</p>
        <p className="text-sm text-muted-foreground">Your dishes have been added as drafts.</p>
        <Link
          href={`/restaurant/${restaurantId}/menu`}
          className="inline-block rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Go to Menu →
        </Link>
      </div>
    );
  }

  // failed
  return (
    <FailedPanel
      jobId={jobId}
      restaurantId={restaurantId}
      lastError={job.last_error}
      attempts={job.attempts}
    />
  );
}

function FailedPanel({
  jobId,
  restaurantId,
  lastError,
  attempts,
}: {
  jobId: string;
  restaurantId: string;
  lastError: string | null;
  attempts: number;
}) {
  const handleRetry = async () => {
    await retryMenuScan(jobId);
  };

  return (
    <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-6 space-y-4">
      <p className="font-medium text-destructive">Scan failed</p>
      {lastError && <p className="text-sm text-muted-foreground font-mono">{lastError}</p>}
      <p className="text-xs text-muted-foreground">Attempts: {attempts} / 3</p>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={handleRetry}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Retry scan
        </button>
        <Link
          href={`/restaurant/${restaurantId}/menu-scan`}
          className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
        >
          Back to scans
        </Link>
      </div>
    </div>
  );
}
