'use client';

import { useEffect, useState } from 'react';
import { Loader2, CheckCircle2, XCircle, Eye, X, UtensilsCrossed } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ScanJob } from '../hooks/menuScanTypes';

interface ScanJobQueueProps {
  jobs: ScanJob[];
  onReview: (tempId: string) => void;
  onDismiss: (tempId: string) => void;
}

function Elapsed({ since }: { since: Date }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick(n => n + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const secs = Math.floor((Date.now() - since.getTime()) / 1000);
  if (secs < 60) return <span>{secs}s</span>;
  const mins = Math.floor(secs / 60);
  return (
    <span>
      {mins}m {secs % 60}s
    </span>
  );
}

export function ScanJobQueue({ jobs, onReview, onDismiss }: ScanJobQueueProps) {
  if (jobs.length === 0) return null;

  return (
    <div className="bg-card rounded-xl border p-5 space-y-3">
      <h2 className="font-semibold text-foreground text-sm">Active Scans ({jobs.length})</h2>
      <div className="space-y-2">
        {jobs.map(job => (
          <div
            key={job.tempId}
            className="flex items-center gap-3 rounded-lg border px-4 py-3 text-sm"
          >
            {/* Status icon */}
            {job.status === 'processing' && (
              <Loader2 className="h-4 w-4 text-brand-primary animate-spin shrink-0" />
            )}
            {job.status === 'needs_review' && (
              <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
            )}
            {job.status === 'failed' && <XCircle className="h-4 w-4 text-destructive shrink-0" />}

            {/* Restaurant name + info */}
            <div className="flex-1 min-w-0">
              <p className="font-medium text-foreground truncate">{job.restaurantName}</p>
              <p className="text-xs text-muted-foreground">
                {job.status === 'processing' && (
                  <>
                    Processing... <Elapsed since={job.startedAt} />
                  </>
                )}
                {job.status === 'needs_review' && job.result && (
                  <span className="flex items-center gap-1">
                    <UtensilsCrossed className="h-3 w-3" />
                    {job.result.dishCount} dishes extracted
                  </span>
                )}
                {job.status === 'failed' && (
                  <span className="text-destructive">{job.error ?? 'Processing failed'}</span>
                )}
              </p>
            </div>

            {/* Actions */}
            {job.status === 'needs_review' && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onReview(job.tempId)}
                className="shrink-0"
              >
                <Eye className="h-3.5 w-3.5 mr-1.5" />
                Review
              </Button>
            )}
            {job.status === 'failed' && (
              <button
                onClick={() => onDismiss(job.tempId)}
                className="p-1.5 text-muted-foreground hover:text-foreground rounded"
                title="Dismiss"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
