'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { EnrichedResult, FlaggedDuplicate, ExtractionNote } from '@/lib/menu-scan';
import type { ScanJob } from './menuScanTypes';

interface JobApiResponse {
  jobId: string;
  currency: string;
  result: EnrichedResult;
  dishCount: number;
  processingMs: number;
  flaggedDuplicates?: FlaggedDuplicate[];
  extractionNotes?: ExtractionNote[];
}

/** Manages a queue of background menu-scan jobs with session recovery */
export function useJobQueue() {
  const [jobs, setJobs] = useState<ScanJob[]>([]);

  // ---------- recover needs_review jobs on mount ----------
  useEffect(() => {
    const recover = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: rows, error } = await supabase
        .from('menu_scan_jobs')
        .select(
          'id, restaurant_id, status, result_json, image_storage_paths, dishes_found, created_at, error_message'
        )
        .eq('created_by', user.id)
        .eq('status', 'needs_review')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error || !rows?.length) return;

      // We need restaurant names for display — fetch them
      const restaurantIds = [...new Set(rows.map(r => r.restaurant_id))];
      const { data: restaurantRows } = await supabase
        .from('restaurants')
        .select('id, name')
        .in('id', restaurantIds);
      const nameMap = new Map(restaurantRows?.map(r => [r.id, r.name]) ?? []);

      const recovered: ScanJob[] = rows.map(row => {
        const resultJson = row.result_json as
          | (EnrichedResult & {
              flaggedDuplicates?: FlaggedDuplicate[];
              extractionNotes?: ExtractionNote[];
            })
          | null;
        return {
          tempId: row.id,
          jobId: row.id,
          restaurantId: row.restaurant_id,
          restaurantName: nameMap.get(row.restaurant_id) ?? 'Unknown',
          status: 'needs_review' as const,
          result: resultJson
            ? {
                currency: resultJson.currency,
                result: { menus: resultJson.menus, currency: resultJson.currency },
                flaggedDuplicates: resultJson.flaggedDuplicates ?? [],
                extractionNotes: resultJson.extractionNotes ?? [],
                dishCount: row.dishes_found ?? 0,
              }
            : undefined,
          imageStoragePaths: row.image_storage_paths ?? undefined,
          startedAt: new Date(row.created_at ?? Date.now()),
        };
      });

      setJobs(recovered);
    };
    recover();
  }, []);

  // ---------- submit a new background job ----------
  const submitJob = useCallback(
    (restaurantId: string, restaurantName: string, fetchPromise: Promise<Response>) => {
      const tempId = crypto.randomUUID();

      const entry: ScanJob = {
        tempId,
        jobId: null,
        restaurantId,
        restaurantName,
        status: 'processing',
        startedAt: new Date(),
      };

      setJobs(prev => [entry, ...prev]);

      // Handle the response asynchronously
      fetchPromise
        .then(async response => {
          const data: JobApiResponse = await response.json();
          if (!response.ok) {
            throw new Error(
              (data as unknown as { error?: string }).error ?? 'AI processing failed'
            );
          }
          setJobs(prev =>
            prev.map(j =>
              j.tempId === tempId
                ? {
                    ...j,
                    jobId: data.jobId,
                    status: 'needs_review' as const,
                    result: {
                      currency: data.currency ?? 'USD',
                      result: data.result,
                      flaggedDuplicates: data.flaggedDuplicates ?? [],
                      extractionNotes: data.extractionNotes ?? data.result?.extractionNotes ?? [],
                      dishCount: data.dishCount,
                    },
                  }
                : j
            )
          );
        })
        .catch((err: unknown) => {
          const msg = err instanceof Error ? err.message : 'Unknown error';
          setJobs(prev =>
            prev.map(j =>
              j.tempId === tempId ? { ...j, status: 'failed' as const, error: msg } : j
            )
          );
        });

      return tempId;
    },
    []
  );

  // ---------- dismiss a job from the queue ----------
  const dismissJob = useCallback((tempId: string) => {
    setJobs(prev => prev.filter(j => j.tempId !== tempId));
  }, []);

  // ---------- get a job by tempId ----------
  const getJob = useCallback(
    (tempId: string) => jobs.find(j => j.tempId === tempId) ?? null,
    [jobs]
  );

  return { jobs, submitJob, dismissJob, getJob };
}
