'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ChevronsUpDown } from 'lucide-react';

export type MenuCategoryOption = {
  // Encoded value handed straight to onChange (e.g. '', 'custom', 'canonical:burgers').
  value: string;
  // Display text — also what the search query matches against.
  label: string;
  // Group header to list this option under. Omit for action rows (e.g.
  // "No category", "Custom name…") which stay pinned above the search results.
  group?: string;
};

type Props = {
  value: string;
  options: MenuCategoryOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  // Trigger text shown when `value` matches no option.
  placeholder?: string;
  className?: string;
  ariaLabel?: string;
};

export function MenuCategoryCombobox({
  value,
  options,
  onChange,
  disabled = false,
  placeholder = '— Select —',
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

  const selectedOption = useMemo(
    () => options.find(o => o.value === value) ?? null,
    [options, value]
  );

  // Action rows (no group) stay pinned and unfiltered so "Custom name…" is
  // always reachable even when the search excludes every taxonomy match.
  const actionOptions = useMemo(() => options.filter(o => !o.group), [options]);
  const groupedOptions = useMemo(() => options.filter(o => o.group), [options]);

  const filteredGrouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return groupedOptions;
    return groupedOptions.filter(o => o.label.toLowerCase().includes(q));
  }, [groupedOptions, query]);

  // Flat list of selectable options in display order — keyboard nav indexes
  // into this without having to skip over group headers.
  const selectable = useMemo(
    () => [...actionOptions, ...filteredGrouped],
    [actionOptions, filteredGrouped]
  );

  // Render rows: selectable options interleaved with a header each time the
  // group label changes.
  type RenderRow =
    | { kind: 'header'; label: string }
    | { kind: 'option'; option: MenuCategoryOption; index: number };
  const renderRows: RenderRow[] = useMemo(() => {
    const out: RenderRow[] = [];
    let lastGroup: string | undefined;
    selectable.forEach((option, index) => {
      if (option.group && option.group !== lastGroup) {
        out.push({ kind: 'header', label: option.group });
        lastGroup = option.group;
      }
      out.push({ kind: 'option', option, index });
    });
    return out;
  }, [selectable]);

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
    // setTimeout 0 so the popover finishes layout before we steal focus —
    // otherwise the focus races the trigger's blur and the popover closes.
    const t = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, [open]);

  // Clamp during render: filtering can shrink `selectable` below the stored index.
  const activeIndex =
    selectable.length === 0 ? 0 : Math.min(highlightedIndex, selectable.length - 1);

  function commit(option: MenuCategoryOption) {
    onChange(option.value);
    setOpen(false);
    setQuery('');
    triggerRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(Math.min(selectable.length - 1, activeIndex + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(Math.max(0, activeIndex - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const option = selectable[activeIndex];
      if (option) commit(option);
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

  const triggerClass = [
    'w-full flex items-center justify-between gap-1 rounded-md border border-border bg-background px-2 py-1.5 text-sm text-left disabled:opacity-50',
    selectedOption ? '' : 'text-muted-foreground',
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
        <span className="truncate">{selectedOption ? selectedOption.label : placeholder}</span>
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
            {selectable.length === 0 ? (
              <li className="px-2 py-1.5 text-xs text-muted-foreground italic">No matches</li>
            ) : (
              renderRows.map(row => {
                if (row.kind === 'header') {
                  return (
                    <li
                      key={`__header__${row.label}`}
                      className="px-2 pt-2 pb-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
                    >
                      {row.label}
                    </li>
                  );
                }
                const isHighlighted = row.index === activeIndex;
                const isSelected = row.option.value === value;
                const itemClass = [
                  'cursor-pointer truncate px-2 py-1.5',
                  isHighlighted ? 'bg-muted' : '',
                  isSelected ? 'font-medium' : '',
                ]
                  .filter(Boolean)
                  .join(' ');
                return (
                  <li
                    key={row.option.value}
                    role="option"
                    aria-selected={isSelected}
                    onMouseEnter={() => setHighlightedIndex(row.index)}
                    onClick={() => commit(row.option)}
                    className={itemClass}
                  >
                    {row.option.label}
                  </li>
                );
              })
            )}
            {query.trim() !== '' && filteredGrouped.length === 0 && (
              <li className="px-2 py-1.5 text-xs text-muted-foreground italic">
                No matching categories
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
