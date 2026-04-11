import { CheckCircle2, AlertTriangle, SkipForward, XCircle, DollarSign } from 'lucide-react';
import type { ImportSummary } from '@/lib/import-types';

interface ImportSummaryCardProps {
  summary: ImportSummary;
}

interface StatItem {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  colorClass: string;
  bgClass: string;
}

export function ImportSummaryCard({ summary }: ImportSummaryCardProps) {
  const stats: StatItem[] = [
    {
      label: 'Imported',
      value: summary.inserted,
      icon: <CheckCircle2 className="h-5 w-5" />,
      colorClass: 'text-green-700',
      bgClass: 'bg-green-50 border-green-200',
    },
    {
      label: 'Flagged',
      value: summary.flagged,
      icon: <AlertTriangle className="h-5 w-5" />,
      colorClass: 'text-amber-700',
      bgClass: 'bg-amber-50 border-amber-200',
    },
    {
      label: 'Skipped',
      value: summary.skipped,
      icon: <SkipForward className="h-5 w-5" />,
      colorClass: 'text-gray-600',
      bgClass: 'bg-gray-50 border-gray-200',
    },
    {
      label: 'Errors',
      value: summary.errors.length,
      icon: <XCircle className="h-5 w-5" />,
      colorClass: 'text-red-700',
      bgClass: 'bg-red-50 border-red-200',
    },
    {
      label: 'API Cost',
      value: `$${summary.estimatedCostUsd.toFixed(4)}`,
      icon: <DollarSign className="h-5 w-5" />,
      colorClass: 'text-blue-700',
      bgClass: 'bg-blue-50 border-blue-200',
    },
  ];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">Import Results</h3>
        <span className="text-xs text-muted-foreground">
          {summary.apiCallsUsed} API call{summary.apiCallsUsed !== 1 ? 's' : ''} used
        </span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className={`flex flex-col items-center justify-center gap-1 rounded-lg border px-3 py-4 ${stat.bgClass}`}
          >
            <div className={stat.colorClass}>{stat.icon}</div>
            <div className={`text-2xl font-bold ${stat.colorClass}`}>{stat.value}</div>
            <div className={`text-xs font-medium ${stat.colorClass}`}>{stat.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
