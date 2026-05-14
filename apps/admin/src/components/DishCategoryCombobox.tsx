'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ChevronsUpDown } from 'lucide-react';
import type { DishCategoryOption } from '@/lib/auth/dal';

type Props = {
  value: string | null;
  options: DishCategoryOption[];
  onChange: (id: string | null) => void;
  disabled?: boolean;
  // Menu-scan-only: AI suggested a category but the fuzzy match didn't clear
  // the threshold. Renders a yellow border to flag the row for admin attention.
  unmatched?: boolean;
  noneLabel?: string;
  className?: string;
  ariaLabel?: string;
};

export function DishCategoryCombobox({
  value,
  options,
  onChange,
  disabled = false,
  unmatched = false,
  noneLabel = '— None —',
  className,
  ariaLabel,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();

  const selected = useMemo(
    () => (value ? (options.find(o => o.id === value) ?? null) : null),
    [value, options]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(o => o.name.toLowerCase().includes(q));
  }, [options, query]);

  // Rows shown in the listbox: optional "— None —" + filtered options.
  // Flat array so keyboard nav can index into it without branching.
  type Row = { kind: 'none' } | { kind: 'option'; option: DishCategoryOption };
  const rows: Row[] = useMemo(() => {
    const out: Row[] = [];
    if (!query.trim()) out.push({ kind: 'none' });
    for (const o of filtered) out.push({ kind: 'option', option: o });
    return out;
  }, [filtered, query]);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e: PointerEvent) {
      const t = e.target as Node | null;
      if (!t) return;
      if (rootRef.current && !rootRef.current.contains(t)) {
        setOpen(false);
        setQuery('');
      }
    }
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    // Focus search input after the popover renders. setTimeout 0 to let the
    // browser finish the layout pass first; otherwise the focus race with
    // the trigger's blur causes the popover to close immediately.
    const t = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, [open]);

  // Clamp during render rather than via setState-in-effect: filtering can
  // shrink rows below the stored highlightedIndex, so derive the displayed
  // value here and reference it from the listbox + Enter handler.
  const activeIndex = rows.length === 0 ? 0 : Math.min(highlightedIndex, rows.length - 1);

  function commit(row: Row) {
    if (row.kind === 'none') {
      onChange(null);
    } else {
      onChange(row.option.id);
    }
    setOpen(false);
    setQuery('');
    triggerRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(Math.min(rows.length - 1, activeIndex + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(Math.max(0, activeIndex - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const row = rows[activeIndex];
      if (row) commit(row);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      setQuery('');
      triggerRef.current?.focus();
    } else if (e.key === 'Tab') {
      setOpen(false);
      setQuery('');
    }
  }

  const triggerLabel = selected
    ? `${selected.name}${selected.is_drink ? ' (drink)' : ''}`
    : noneLabel;

  const triggerClass = [
    'w-full flex items-center justify-between gap-1 rounded-md border bg-background px-2 py-1 text-sm text-left disabled:opacity-50',
    unmatched ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20' : 'border-input',
    selected ? '' : 'text-muted-foreground',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-label={ariaLabel}
        onClick={() => {
          if (disabled) return;
          setOpen(o => {
            if (!o) setHighlightedIndex(0);
            return !o;
          });
        }}
        className={triggerClass}
      >
        <span className="truncate">{triggerLabel}</span>
        <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden />
      </button>

      {open && (
        <div className="absolute left-0 z-50 mt-1 min-w-full w-[20rem] max-w-[calc(100vw-2rem)] rounded-md border border-border bg-background shadow-md">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => {
              setQuery(e.target.value);
              setHighlightedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Search categories…"
            className="w-full rounded-t-md border-b border-border bg-background px-2 py-1.5 text-sm focus:outline-none"
          />
          <ul
            id={listboxId}
            role="listbox"
            className="max-h-56 overflow-auto py-1 text-sm"
            // mousedown (not click) so the option commits before the input
            // loses focus and the outside-click handler closes the popover.
            onMouseDown={e => e.preventDefault()}
          >
            {rows.length === 0 ? (
              <li className="px-2 py-1.5 text-xs text-muted-foreground italic">No matches</li>
            ) : (
              rows.map((row, i) => {
                const isHighlighted = i === activeIndex;
                const isSelected = row.kind === 'none' ? value == null : row.option.id === value;
                const baseClass =
                  'cursor-pointer px-2 py-1.5 flex items-center justify-between gap-2';
                const stateClass = isHighlighted ? 'bg-muted' : '';
                const selectedClass = isSelected ? 'font-medium' : '';
                const className = [baseClass, stateClass, selectedClass].filter(Boolean).join(' ');
                if (row.kind === 'none') {
                  return (
                    <li
                      key="__none__"
                      role="option"
                      aria-selected={isSelected}
                      onMouseEnter={() => setHighlightedIndex(i)}
                      onClick={() => commit(row)}
                      className={`${className} text-muted-foreground`}
                    >
                      {noneLabel}
                    </li>
                  );
                }
                return (
                  <li
                    key={row.option.id}
                    role="option"
                    aria-selected={isSelected}
                    onMouseEnter={() => setHighlightedIndex(i)}
                    onClick={() => commit(row)}
                    className={className}
                  >
                    <span className="truncate">{row.option.name}</span>
                    {row.option.is_drink && (
                      <span className="shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">
                        drink
                      </span>
                    )}
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
