'use client';

import { FileText } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';

export default function AuditLogsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Audit Logs" />
      <EmptyState
        icon={FileText}
        title="Audit Logs Coming Soon"
        description="Action logging is active. The audit viewer is under development."
      />
    </div>
  );
}
