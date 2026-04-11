'use client';

import { ReactNode } from 'react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface FilterConfig {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ label: string; value: string }>;
}

interface SearchFilterBarProps {
  search: { value: string; onChange: (v: string) => void; placeholder?: string };
  filters?: FilterConfig[];
  actions?: ReactNode;
}

export function SearchFilterBar({ search, filters, actions }: SearchFilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Input
        className="min-w-[200px] max-w-xs"
        placeholder={search.placeholder ?? 'Search...'}
        value={search.value}
        onChange={(e) => search.onChange(e.target.value)}
      />
      {filters?.map((filter, i) => (
        <Select key={i} value={filter.value} onValueChange={filter.onChange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={filter.label} />
          </SelectTrigger>
          <SelectContent>
            {filter.options.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ))}
      {actions && <div className="ml-auto">{actions}</div>}
    </div>
  );
}
