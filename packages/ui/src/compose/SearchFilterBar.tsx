'use client';

import React from 'react';
import { cn } from '../lib/utils';

export interface SearchFilterBarProps {
  search?: string;
  onSearchChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
  children?: React.ReactNode;
}

export function SearchFilterBar({
  search = '',
  onSearchChange,
  placeholder = 'Search…',
  className,
  children,
}: SearchFilterBarProps) {
  return (
    <div className={cn('flex flex-wrap items-center gap-3', className)}>
      <input
        type="search"
        value={search}
        onChange={e => onSearchChange?.(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="flex-1 min-w-48 h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      />
      {children}
    </div>
  );
}
