'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  adminCopyRestaurantMenu,
  searchCopySourceRestaurants,
  type CopyMenuCounts,
  type CopySourceCandidate,
} from './actions/copyMenu';

// Copy-menu UI (operator issue #16). Only rendered while the restaurant has no
// menus (the RPC enforces the same guard server-side) — multi-branch setup:
// create the branch, copy the menu from the original, then edit per-branch.

interface Props {
  restaurantId: string;
  restaurantName: string;
}

export function CopyMenuSection({ restaurantId, restaurantName }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [candidates, setCandidates] = useState<CopySourceCandidate[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<CopySourceCandidate | null>(null);
  const [copying, setCopying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CopyMenuCounts | null>(null);
  const searchSeq = useRef(0);

  // Debounced name search; sequence counter drops stale responses.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setCandidates([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const seq = ++searchSeq.current;
    const handle = setTimeout(() => {
      void searchCopySourceRestaurants(restaurantId, q).then(res => {
        if (seq !== searchSeq.current) return;
        setSearching(false);
        setCandidates(res.ok ? res.data : []);
      });
    }, 300);
    return () => clearTimeout(handle);
  }, [query, restaurantId]);

  async function handleCopy() {
    if (!selected) return;
    setError(null);
    setCopying(true);
    try {
      const res = await adminCopyRestaurantMenu(restaurantId, selected.id);
      if (!res.ok) {
        setError(res.formError ?? 'Copy failed');
        return;
      }
      setResult(res.data);
      router.refresh();
    } finally {
      setCopying(false);
    }
  }

  if (result) {
    return (
      <section className="rounded-lg border border-green-200 bg-green-50 p-4 space-y-1 dark:border-green-900/40 dark:bg-green-900/10">
        <h2 className="font-semibold text-sm text-green-900 dark:text-green-200">Menu copied</h2>
        <p className="text-sm text-green-900/80 dark:text-green-200/80">
          {result.dishes_copied} dishes in {result.categories_copied} categories (
          {result.menus_copied} menu{result.menus_copied === 1 ? '' : 's'},{' '}
          {result.option_groups_copied} modifier groups, {result.options_copied} options) copied
          from <strong>{selected?.name}</strong> as drafts. Review and publish below.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-border p-4 space-y-3">
      <div>
        <h2 className="font-semibold text-sm">Copy menu from another restaurant</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          For branches sharing one menu: clones menus, categories, dishes and modifier groups into{' '}
          <strong>{restaurantName}</strong> as drafts. One-time copy — afterwards each branch is
          edited separately.
        </p>
      </div>

      {selected === null ? (
        <>
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search source restaurant by name…"
            aria-label="Search source restaurant"
            className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
          />
          {searching && <p className="text-xs text-muted-foreground">Searching…</p>}
          {!searching && query.trim().length >= 2 && candidates.length === 0 && (
            <p className="text-xs text-muted-foreground">No restaurants match.</p>
          )}
          {candidates.length > 0 && (
            <ul className="divide-y divide-border rounded border border-border">
              {candidates.map(c => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(c)}
                    disabled={c.dish_count === 0}
                    className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-muted disabled:opacity-50"
                  >
                    <span>
                      {c.name}
                      {c.city ? <span className="text-muted-foreground"> · {c.city}</span> : null}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {c.dish_count} dish{c.dish_count === 1 ? '' : 'es'} · {c.status}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <div className="space-y-2 rounded border border-border bg-muted/20 p-3">
          <p className="text-sm">
            Copy <strong>{selected.dish_count}</strong> dish
            {selected.dish_count === 1 ? '' : 'es'} from <strong>{selected.name}</strong>
            {selected.city ? ` (${selected.city})` : ''} into <strong>{restaurantName}</strong>?
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void handleCopy()}
              disabled={copying}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {copying ? 'Copying…' : 'Copy menu'}
            </button>
            <button
              type="button"
              onClick={() => {
                setSelected(null);
                setError(null);
              }}
              disabled={copying}
              className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-muted disabled:opacity-50"
            >
              Back
            </button>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
