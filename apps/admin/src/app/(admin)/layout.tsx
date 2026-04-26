import { verifyAdminSession } from '@/lib/auth/dal';
import { AdminNav } from '@/components/AdminNav';
import { ThemeToggle } from '@/components/ThemeToggle';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await verifyAdminSession();
  return (
    <div className="flex min-h-screen bg-background">
      <aside className="w-64 border-r bg-card flex flex-col p-4">
        <div className="flex items-center gap-2 px-3 mb-6">
          <div className="size-7 rounded-md bg-brand-primary flex items-center justify-center">
            <span className="text-white text-xs font-bold">EM</span>
          </div>
          <p className="text-sm font-semibold">EatMe Admin</p>
        </div>
        <AdminNav />
        <p className="text-[11px] text-muted-foreground px-3 mt-2">v0.1.0 — internal</p>
      </aside>
      <div className="flex-1 flex flex-col">
        <header className="h-14 border-b bg-card flex items-center justify-between px-6">
          <p className="text-sm font-semibold text-muted-foreground">Admin Portal</p>
          <ThemeToggle />
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
