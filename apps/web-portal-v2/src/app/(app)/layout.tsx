import { verifySession } from '@/lib/auth/dal';
import { RealtimeStatusListener } from '@/components/restaurant/RealtimeStatusListener';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await verifySession();
  return (
    <div className="flex min-h-screen">
      <aside className="w-64 border-r bg-background flex flex-col p-4">
        <nav className="flex-1">
          <p className="text-sm font-semibold text-muted-foreground mb-2">Navigation</p>
        </nav>
      </aside>
      <div className="flex-1 flex flex-col">
        <header className="h-14 border-b flex items-center px-6">
          <p className="text-sm text-muted-foreground">Owner Portal</p>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
      <RealtimeStatusListener userId={userId} />
    </div>
  );
}
