'use client';

import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { useReviewStore } from '../store';

const UNDO_WINDOW_MS = 15 * 60 * 1000;

function formatCountdown(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

export function UndoToast() {
  const lastSavedAt = useReviewStore(s => s.lastSavedAt);
  const lastSavedJobId = useReviewStore(s => s.lastSavedJobId);
  const lastSavedCount = useReviewStore(s => s.lastSavedCount);
  const clearLastSaved = useReviewStore(s => s.clearLastSaved);
  const clearDraft = useReviewStore(s => s.clearDraft);
  const jobId = useReviewStore(s => s.jobId);

  const [remaining, setRemaining] = useState<number>(UNDO_WINDOW_MS);
  const [undoing, setUndoing] = useState(false);

  useEffect(() => {
    if (!lastSavedAt) return;

    const tick = () => {
      const elapsed = Date.now() - lastSavedAt.getTime();
      const rem = UNDO_WINDOW_MS - elapsed;
      if (rem <= 0) {
        clearLastSaved();
        return;
      }
      setRemaining(rem);
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [lastSavedAt, clearLastSaved]);

  const handleUndo = useCallback(async () => {
    if (undoing || !lastSavedJobId) return;
    setUndoing(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const res = await fetch('/api/menu-scan/undo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: session?.access_token ? `Bearer ${session.access_token}` : '',
        },
        body: JSON.stringify({ job_id: lastSavedJobId }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? 'Undo failed');
        return;
      }
      clearDraft(jobId);
      clearLastSaved();
      toast.success(`Undone — ${data.undone} dishes removed`);
    } catch {
      toast.error('Undo request failed');
    } finally {
      setUndoing(false);
    }
  }, [undoing, lastSavedJobId, clearDraft, clearLastSaved, jobId]);

  if (!lastSavedAt) return null;

  return (
    <div
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-foreground text-background rounded-full px-4 py-2.5 shadow-lg text-sm"
      data-testid="undo-toast"
    >
      <span>
        Saved {lastSavedCount} dish{lastSavedCount !== 1 ? 'es' : ''}
      </span>
      <span className="text-background/60">·</span>
      <Button
        variant="ghost"
        size="sm"
        className="h-auto p-0 text-background hover:text-background/80 hover:bg-transparent font-medium flex items-center gap-1"
        onClick={handleUndo}
        disabled={undoing}
        data-testid="undo-button"
      >
        <Undo2 className="h-3.5 w-3.5" />
        Undo ({formatCountdown(remaining)})
      </Button>
    </div>
  );
}
