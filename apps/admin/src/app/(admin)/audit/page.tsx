import { getAdminAuditLog } from '@/lib/auth/dal';
import { verifyAdminSession } from '@/lib/auth/dal';
import { AuditLogTable } from './AuditLogTable';

interface Props {
  searchParams: Promise<{
    actor?: string;
    action?: string;
    date_from?: string;
    date_to?: string;
    page?: string;
  }>;
}

export default async function AuditLogPage({ searchParams }: Props) {
  await verifyAdminSession();
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? '1') || 1);

  const { rows, total } = await getAdminAuditLog({
    actorEmail: sp.actor,
    action: sp.action,
    dateFrom: sp.date_from,
    dateTo: sp.date_to,
    page,
    limit: 50,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Audit Log</h1>
        <p className="text-sm text-muted-foreground">{total} entries</p>
      </div>
      <AuditLogTable
        rows={rows}
        total={total}
        page={page}
        filters={{
          actor: sp.actor ?? '',
          action: sp.action ?? '',
          date_from: sp.date_from ?? '',
          date_to: sp.date_to ?? '',
        }}
      />
    </div>
  );
}
