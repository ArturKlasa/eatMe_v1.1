'use client';

import { useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { AlertTriangle } from 'lucide-react';
import { useReviewStore } from '../store';
import { selectConfirmSummary, selectFlaggedDishes } from '../store/selectors';

interface SavePreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SavePreviewModal({ open, onOpenChange }: SavePreviewModalProps) {
  const [saveAnyway, setSaveAnyway] = useState(false);

  // Subscribe to stable references; derive computed values with useMemo to
  // avoid returning new object/array references from selectors on every render
  // (which triggers React 19's infinite-loop detection in useSyncExternalStore).
  const editableMenus = useReviewStore(s => s.editableMenus);
  const handleSave = useReviewStore(s => s.handleSave);
  const saving = useReviewStore(s => s.saving);

  const summary = useMemo(() => selectConfirmSummary({ editableMenus }), [editableMenus]);
  const flaggedDishes = useMemo(() => selectFlaggedDishes({ editableMenus }), [editableMenus]);

  const blocked = flaggedDishes.length > 0 && !saveAnyway;

  async function handleConfirm() {
    if (blocked) return;
    onOpenChange(false);
    await handleSave();
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) setSaveAnyway(false);
    onOpenChange(nextOpen);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Save to database</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-muted/30 rounded-lg p-3">
              <div className="text-2xl font-bold" data-testid="insert-count">
                {summary.insertCount}
              </div>
              <div className="text-muted-foreground">dishes to save</div>
            </div>
            {summary.acceptedFlaggedCount > 0 && (
              <div className="bg-muted/30 rounded-lg p-3">
                <div className="text-2xl font-bold" data-testid="accepted-flagged-count">
                  {summary.acceptedFlaggedCount}
                </div>
                <div className="text-muted-foreground">flagged accepted</div>
              </div>
            )}
          </div>

          {flaggedDishes.length > 0 && (
            <div
              className="border border-warning/50 bg-warning/10 rounded-lg p-3 space-y-2"
              data-testid="untouched-flagged-warning"
            >
              <p className="text-sm font-medium flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
                {flaggedDishes.length} low-confidence dish
                {flaggedDishes.length !== 1 ? 'es' : ''} not reviewed
              </p>
              <ul className="text-xs text-muted-foreground space-y-0.5 max-h-32 overflow-y-auto">
                {flaggedDishes.map(d => (
                  <li key={d._id} className="truncate">
                    • {d.name || 'Unnamed dish'}
                  </li>
                ))}
              </ul>
              <div className="flex items-center gap-2 pt-1">
                <Checkbox
                  id="save-anyway"
                  checked={saveAnyway}
                  onCheckedChange={v => setSaveAnyway(!!v)}
                  data-testid="save-anyway-checkbox"
                />
                <Label htmlFor="save-anyway" className="text-sm cursor-pointer">
                  Save anyway
                </Label>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={blocked || saving}
            className="bg-brand-primary hover:bg-brand-primary/90 text-background"
            data-testid="confirm-save-button"
          >
            {saving
              ? 'Saving…'
              : `Save ${summary.insertCount} dish${summary.insertCount !== 1 ? 'es' : ''}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
