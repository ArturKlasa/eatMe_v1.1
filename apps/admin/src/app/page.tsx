import Link from 'next/link';
import { Button } from '@eatme/ui';

export default function HomePage() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden p-6">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--brand-primary)/10%,_transparent_60%)]"
      />
      <div className="w-full max-w-md space-y-6 rounded-xl border bg-card p-8 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-lg bg-brand-primary flex items-center justify-center">
            <span className="text-white font-bold">EM</span>
          </div>
          <div className="space-y-0.5">
            <h1 className="text-xl font-semibold leading-tight">EatMe Admin</h1>
            <p className="text-xs text-muted-foreground">Internal tools</p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Manage restaurants, run menu scans, import data, and review audit logs.
        </p>
        <Button asChild className="w-full">
          <Link href="/restaurants">Open dashboard</Link>
        </Button>
      </div>
    </main>
  );
}
