'use client';

import { useState } from 'react';

interface Props {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any>;
}

export function RestaurantInspector({ data }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <section className="rounded-lg border border-border">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium hover:bg-muted/50"
        aria-expanded={open}
      >
        <span>Raw DB row</span>
        <span className="text-muted-foreground">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <pre className="overflow-auto p-4 text-xs text-muted-foreground border-t border-border max-h-96">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </section>
  );
}
