'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, Unlink, Check, X, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { DISH_KINDS } from '@/lib/constants';
import type { EditableDish } from '@/lib/menu-scan';

interface DishGroupCardProps {
  parent: EditableDish;
  children: EditableDish[];
  onAccept: () => void;
  onReject: () => void;
  onEdit: () => void;
  onUngroup: (childId: string) => void;
  onUpdateDish: (dishId: string, updates: Partial<EditableDish>) => void;
  currency: string;
  isSelected: boolean;
  onToggleSelect: () => void;
}

export function DishGroupCard({
  parent,
  children,
  onAccept,
  onReject,
  onEdit,
  onUngroup,
  onUpdateDish,
  currency,
  isSelected,
  onToggleSelect,
}: DishGroupCardProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const confidencePct = Math.round(parent.confidence * 100);
  const confidenceColor =
    parent.confidence >= 0.85
      ? 'bg-success/10 text-success'
      : parent.confidence >= 0.6
        ? 'bg-yellow-100 text-yellow-700'
        : 'bg-destructive/10 text-destructive';

  const statusColor =
    parent.group_status === 'accepted'
      ? 'border-green-300 bg-success/10'
      : parent.group_status === 'rejected'
        ? 'border-red-300 bg-destructive/10'
        : 'border-blue-200 bg-info/10';

  const dishKindInfo = DISH_KINDS.find(k => k.value === parent.dish_kind);

  return (
    <div className={cn('rounded-lg border-2 p-3 transition-all duration-200', statusColor)}>
      {/* Parent header */}
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onToggleSelect}
          className="h-4 w-4 rounded border-input"
        />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm truncate">{parent.name}</span>
            {dishKindInfo && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-purple-100 text-purple-700">
                {dishKindInfo.icon} {dishKindInfo.label}
              </span>
            )}
            <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded', confidenceColor)}>
              {confidencePct}%
            </span>
          </div>
          {parent.description && (
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{parent.description}</p>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {/* dish_kind dropdown */}
          <select
            value={parent.dish_kind}
            onChange={e =>
              onUpdateDish(parent._id, {
                dish_kind: e.target.value as EditableDish['dish_kind'],
              })
            }
            className="text-xs border rounded px-1 py-0.5"
          >
            {DISH_KINDS.map(k => (
              <option key={k.value} value={k.value}>
                {k.icon} {k.label}
              </option>
            ))}
          </select>

          {/* Accept / Reject / Edit buttons */}
          <Button
            size="sm"
            variant="ghost"
            onClick={onAccept}
            className="h-7 w-7 p-0 text-success hover:bg-success/10"
            title="Accept (A)"
            aria-label="Accept dish group"
          >
            <Check className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onReject}
            className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
            title="Reject (R)"
            aria-label="Reject dish group"
          >
            <X className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onEdit}
            className="h-7 w-7 p-0 text-info hover:bg-info/10"
            title="Edit (E)"
            aria-label="Edit dish group"
          >
            <Pencil className="h-4 w-4" />
          </Button>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 text-muted-foreground hover:text-foreground"
            aria-label={isExpanded ? 'Collapse variants' : 'Expand variants'}
          >
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Variant children (indented, left-border connector) */}
      {isExpanded && children.length > 0 && (
        <div className="mt-2 ml-4 border-l-2 border-blue-200 pl-3 space-y-1.5">
          {children.map(child => (
            <div
              key={child._id}
              className="flex items-center gap-2 py-1 px-2 rounded bg-background/60 text-sm"
            >
              <span className="flex-1 truncate">{child.name}</span>
              <span className="text-xs text-muted-foreground">
                {currency} {child.price || '—'}
              </span>
              {child.dietary_tags.length > 0 && (
                <span className="text-[10px] text-muted-foreground">
                  {child.dietary_tags.join(', ')}
                </span>
              )}

              {/* serves */}
              <input
                type="number"
                min="1"
                value={child.serves ?? 1}
                onChange={e =>
                  onUpdateDish(child._id, { serves: parseInt(e.target.value) || 1 })
                }
                className="w-12 text-xs border rounded px-1 py-0.5 text-center"
                title="Serves"
              />

              {/* display_price_prefix */}
              <select
                value={child.display_price_prefix}
                onChange={e =>
                  onUpdateDish(child._id, {
                    display_price_prefix: e.target.value as EditableDish['display_price_prefix'],
                  })
                }
                className="text-[10px] border rounded px-1 py-0.5"
                title="Price display"
              >
                <option value="exact">Exact</option>
                <option value="from">From</option>
                <option value="per_person">Per person</option>
                <option value="market_price">Market price</option>
                <option value="ask_server">Ask server</option>
              </select>

              <Button
                size="sm"
                variant="ghost"
                onClick={() => onUngroup(child._id)}
                className="h-6 w-6 p-0 text-muted-foreground hover:text-brand-primary"
                title="Ungroup (remove from parent)"
                aria-label="Ungroup variant"
              >
                <Unlink className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Parent-level serves & display_price_prefix */}
      {isExpanded && (
        <div className="mt-2 ml-4 flex items-center gap-3 text-xs text-muted-foreground">
          <label className="flex items-center gap-1">
            Serves:
            <input
              type="number"
              min="1"
              value={parent.serves ?? 1}
              onChange={e =>
                onUpdateDish(parent._id, { serves: parseInt(e.target.value) || 1 })
              }
              className="w-12 border rounded px-1 py-0.5 text-center"
            />
          </label>
          <label className="flex items-center gap-1">
            Price display:
            <select
              value={parent.display_price_prefix}
              onChange={e =>
                onUpdateDish(parent._id, {
                  display_price_prefix: e.target.value as EditableDish['display_price_prefix'],
                })
              }
              className="border rounded px-1 py-0.5"
            >
              <option value="exact">Exact</option>
              <option value="from">From</option>
              <option value="per_person">Per person</option>
              <option value="market_price">Market price</option>
              <option value="ask_server">Ask server</option>
            </select>
          </label>
        </div>
      )}
    </div>
  );
}
