'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  Loader2,
  Utensils,
  AlertTriangle,
  AlertCircle,
  Info,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Keyboard,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { computeMenuWarnings, extractionNotesToWarnings } from '@/lib/menu-scan-warnings';
import type { MenuWarning } from '@/lib/menu-scan-warnings';
import { countDishes } from '@/lib/menu-scan';
import { useReviewStore } from '../store';

const SEVERITY_ORDER = { error: 0, warning: 1, info: 2 } as const;
const SEVERITY_CONFIG = {
  error: { icon: AlertCircle, color: 'text-destructive', bg: 'bg-destructive/10', label: 'Error' },
  warning: { icon: AlertTriangle, color: 'text-warning', bg: 'bg-warning/10', label: 'Warning' },
  info: { icon: Info, color: 'text-info', bg: 'bg-info/10', label: 'Info' },
} as const;

const SHORTCUTS = [
  { key: 'E', description: 'Expand / collapse all dishes' },
  { key: 'N', description: 'Focus next flagged dish' },
  { key: '⌘/Ctrl S', description: 'Open save dialog' },
  { key: 'A', description: 'Accept focused group' },
  { key: 'R', description: 'Reject focused group' },
  { key: 'Esc', description: 'Close lightbox / deselect' },
] as const;

function KeyboardShortcutHelp() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1 px-2 text-muted-foreground"
          aria-label="Keyboard shortcuts"
        >
          <Keyboard className="h-4 w-4" />
          <span className="text-xs hidden sm:inline">Shortcuts</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 p-3" data-testid="shortcuts-dropdown">
        <p className="text-[10px] font-semibold uppercase text-muted-foreground tracking-wide mb-2">
          Keyboard Shortcuts
        </p>
        <div className="space-y-1.5">
          {SHORTCUTS.map(s => (
            <div key={s.key} className="flex items-center justify-between gap-4 text-xs">
              <span className="text-muted-foreground">{s.description}</span>
              <kbd className="shrink-0 px-1.5 py-0.5 bg-muted rounded font-mono text-[10px] text-foreground">
                {s.key}
              </kbd>
            </div>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface ReviewHeaderProps {
  onOpenSaveModal: () => void;
}

export function ReviewHeader({ onOpenSaveModal }: ReviewHeaderProps) {
  const selectedRestaurant = useReviewStore(s => s.selectedRestaurant);
  const currency = useReviewStore(s => s.currency);
  const editableMenus = useReviewStore(s => s.editableMenus);
  const imageFiles = useReviewStore(s => s.imageFiles);
  const saving = useReviewStore(s => s.saving);
  const extractionNotes = useReviewStore(s => s.extractionNotes);
  const setStep = useReviewStore(s => s.setStep);
  const setExpandedDishes = useReviewStore(s => s.setExpandedDishes);

  const totalDishes = useMemo(() => countDishes(editableMenus), [editableMenus]);
  const menuWarnings = useMemo(
    () => [
      ...computeMenuWarnings(editableMenus, currency),
      ...extractionNotesToWarnings(extractionNotes),
    ],
    [editableMenus, currency, extractionNotes]
  );

  const [showWarnings, setShowWarnings] = useState(false);

  const errorCount = menuWarnings.filter(w => w.severity === 'error').length;
  const warningCount = menuWarnings.filter(w => w.severity === 'warning').length;
  const infoCount = menuWarnings.filter(w => w.severity === 'info').length;

  const sorted = [...menuWarnings].sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
  );

  const handleWarningClick = useCallback(
    (w: MenuWarning) => {
      if (!w.dishId) return;
      setExpandedDishes(prev => {
        const next = new Set(prev);
        next.add(w.dishId!);
        return next;
      });
      requestAnimationFrame(() => {
        const el = document.querySelector(`[data-dish-id="${w.dishId}"]`);
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    },
    [setExpandedDishes]
  );

  return (
    <div className="shrink-0 space-y-2">
      <div className="flex items-center justify-between pb-2">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Utensils className="h-5 w-5 text-brand-primary" />
            Review: {selectedRestaurant?.name}
            <span className="text-sm font-normal text-muted-foreground ml-1">({currency})</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {totalDishes} dish{totalDishes !== 1 ? 'es' : ''} extracted — {imageFiles.length} image
            {imageFiles.length !== 1 ? 's' : ''}. Edit as needed, then save.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <KeyboardShortcutHelp />
          <Button variant="outline" onClick={() => setStep('upload')} disabled={saving}>
            ← Re-scan
          </Button>
          <Button
            onClick={onOpenSaveModal}
            disabled={saving || totalDishes === 0}
            className="bg-brand-primary hover:bg-brand-primary/90 text-background"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Saving…
              </>
            ) : (
              <>Save {totalDishes} dishes to DB</>
            )}
          </Button>
        </div>
      </div>

      {/* Warning banner */}
      {menuWarnings.length > 0 && (
        <div className="border rounded-lg overflow-hidden">
          <button
            onClick={() => setShowWarnings(v => !v)}
            className="w-full flex items-center justify-between px-4 py-2 bg-muted/30 hover:bg-muted/50 transition-colors text-sm"
          >
            <div className="flex items-center gap-3">
              {errorCount > 0 && (
                <span className="flex items-center gap-1 text-destructive font-medium">
                  <AlertCircle className="h-3.5 w-3.5" />
                  {errorCount} error{errorCount !== 1 ? 's' : ''}
                </span>
              )}
              {warningCount > 0 && (
                <span className="flex items-center gap-1 text-warning font-medium">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {warningCount} warning{warningCount !== 1 ? 's' : ''}
                </span>
              )}
              {infoCount > 0 && (
                <span className="flex items-center gap-1 text-info font-medium">
                  <Info className="h-3.5 w-3.5" />
                  {infoCount} info
                </span>
              )}
            </div>
            {showWarnings ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </button>

          {showWarnings && (
            <div className="max-h-48 overflow-y-auto divide-y">
              {sorted.map((w, i) => {
                const cfg = SEVERITY_CONFIG[w.severity];
                const Icon = cfg.icon;
                const isAi = w.source === 'ai';
                const isClickable = Boolean(w.dishId);
                return (
                  <div
                    key={i}
                    role={isClickable ? 'button' : undefined}
                    tabIndex={isClickable ? 0 : undefined}
                    onClick={isClickable ? () => handleWarningClick(w) : undefined}
                    onKeyDown={
                      isClickable
                        ? e => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              handleWarningClick(w);
                            }
                          }
                        : undefined
                    }
                    className={`flex items-start gap-2 px-4 py-2 text-xs ${
                      isClickable
                        ? 'cursor-pointer hover:bg-muted/40 transition-colors focus:outline-none focus:ring-1 focus:ring-inset focus:ring-brand-primary/50'
                        : ''
                    }`}
                    data-testid="warning-row"
                    data-dish-id-target={w.dishId}
                  >
                    <Icon className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${cfg.color}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start gap-1.5">
                        {isAi && (
                          <Sparkles
                            className="h-3 w-3 shrink-0 mt-0.5 text-brand-primary"
                            aria-label="AI-detected"
                          />
                        )}
                        <div>
                          <span className="text-muted-foreground">{w.path}</span>
                          <span className="mx-1.5 text-muted-foreground/50">—</span>
                          <span className="text-foreground">{w.message}</span>
                        </div>
                      </div>
                      {w.suggestion && (
                        <p className="mt-0.5 ml-4 italic text-muted-foreground">
                          Suggestion: {w.suggestion}
                        </p>
                      )}
                      {isClickable && (
                        <p className="mt-0.5 ml-4 text-brand-primary/70 text-[10px]">
                          Click to jump to dish ↗
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
