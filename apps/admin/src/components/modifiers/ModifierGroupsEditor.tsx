'use client';

import { useState } from 'react';
import { PRIMARY_PROTEINS, getCurrencyInfo, isSupportedCurrency } from '@eatme/shared';
import type { EditableModifierGroup, EditableModifierOption } from './editableTypes';

interface Props {
  groups: EditableModifierGroup[];
  saving: boolean;
  // ISO 4217 from the parent restaurant. Used to render the currency symbol
  // next to the price_delta + price_override inputs so admins know which
  // currency the number is in. Falls back to USD ('$') if absent.
  currencyCode: string;
  onAddGroup: () => void;
  onRemoveGroup: (groupIdx: number) => void;
  onMoveGroup: (from: number, to: number) => void;
  onUpdateGroup: (groupIdx: number, patch: Partial<EditableModifierGroup>) => void;
  onAddOption: (groupIdx: number) => void;
  onRemoveOption: (groupIdx: number, optIdx: number) => void;
  onMoveOption: (groupIdx: number, from: number, to: number) => void;
  onUpdateOption: (
    groupIdx: number,
    optIdx: number,
    patch: Partial<EditableModifierOption>
  ) => void;
  // Optional (menu-scan review only): opens the supplementary scan-from-image
  // panel targeting this dish. Absent on the restaurant-detail editor.
  onScanFromImage?: () => void;
}

export function ModifierGroupsEditor({
  groups,
  saving,
  currencyCode,
  onScanFromImage,
  onAddGroup,
  onRemoveGroup,
  onMoveGroup,
  onUpdateGroup,
  onAddOption,
  onRemoveOption,
  onMoveOption,
  onUpdateOption,
}: Props) {
  const currencySymbol = isSupportedCurrency(currencyCode)
    ? getCurrencyInfo(currencyCode).symbol
    : '$';
  return (
    <div className="rounded border border-dashed border-amber-200 bg-amber-50/40 p-2 space-y-2 dark:border-amber-900/40 dark:bg-amber-950/20">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-amber-900 dark:text-amber-200">
          Modifier groups ({groups.length})
        </span>
        <div className="flex gap-1.5">
          {onScanFromImage && (
            <button
              type="button"
              onClick={onScanFromImage}
              disabled={saving}
              title="Extract modifier groups / bundled items from a photo or screenshot and attach them to this dish"
              className="rounded border border-amber-300 bg-background px-2 py-0.5 text-xs hover:bg-amber-100 dark:border-amber-800 dark:hover:bg-amber-900/40 disabled:opacity-50"
            >
              📷 Scan from image
            </button>
          )}
          <button
            type="button"
            onClick={onAddGroup}
            disabled={saving}
            className="rounded border border-amber-300 bg-background px-2 py-0.5 text-xs hover:bg-amber-100 dark:border-amber-800 dark:hover:bg-amber-900/40 disabled:opacity-50"
          >
            + Add group
          </button>
        </div>
      </div>

      {groups.length === 0 ? (
        <p className="text-[11px] italic text-muted-foreground">
          No modifier groups. Add one to let customers customise this dish (e.g. protein choice,
          toppings, size).
        </p>
      ) : (
        <ul className="space-y-2">
          {groups.map((group, groupIdx) => (
            <GroupRow
              key={group._id}
              group={group}
              groupIdx={groupIdx}
              isFirst={groupIdx === 0}
              isLast={groupIdx === groups.length - 1}
              saving={saving}
              currencySymbol={currencySymbol}
              onRemoveGroup={onRemoveGroup}
              onMoveGroup={onMoveGroup}
              onUpdateGroup={onUpdateGroup}
              onAddOption={onAddOption}
              onRemoveOption={onRemoveOption}
              onMoveOption={onMoveOption}
              onUpdateOption={onUpdateOption}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

interface GroupRowProps {
  group: EditableModifierGroup;
  groupIdx: number;
  isFirst: boolean;
  isLast: boolean;
  saving: boolean;
  currencySymbol: string;
  onRemoveGroup: (groupIdx: number) => void;
  onMoveGroup: (from: number, to: number) => void;
  onUpdateGroup: (groupIdx: number, patch: Partial<EditableModifierGroup>) => void;
  onAddOption: (groupIdx: number) => void;
  onRemoveOption: (groupIdx: number, optIdx: number) => void;
  onMoveOption: (groupIdx: number, from: number, to: number) => void;
  onUpdateOption: (
    groupIdx: number,
    optIdx: number,
    patch: Partial<EditableModifierOption>
  ) => void;
}

function GroupRow({
  group,
  groupIdx,
  isFirst,
  isLast,
  saving,
  currencySymbol,
  onRemoveGroup,
  onMoveGroup,
  onUpdateGroup,
  onAddOption,
  onRemoveOption,
  onMoveOption,
  onUpdateOption,
}: GroupRowProps) {
  return (
    <li className="rounded border border-amber-200 bg-background p-2 space-y-2 dark:border-amber-900/40">
      <div className="flex items-center gap-2">
        <input
          aria-label="Group name"
          value={group.name}
          onChange={e => onUpdateGroup(groupIdx, { name: e.target.value })}
          disabled={saving}
          placeholder="Group name (e.g. Protein, Size, Toppings)"
          className="flex-1 rounded border border-border bg-background px-2 py-1 text-sm disabled:opacity-50"
        />
        <select
          aria-label="Selection type"
          value={group.selection_type}
          onChange={e => {
            const next = e.target.value as 'single' | 'multiple';
            const patch: Partial<EditableModifierGroup> = { selection_type: next };
            // Single = exactly 1 max; flip max_selections so the row stays sane.
            if (next === 'single') {
              patch.max_selections = 1;
              if (group.min_selections > 1) patch.min_selections = 1;
            }
            onUpdateGroup(groupIdx, patch);
          }}
          disabled={saving}
          className="rounded border border-border bg-background px-2 py-1 text-xs disabled:opacity-50"
        >
          <option value="single">Single</option>
          <option value="multiple">Multiple</option>
        </select>
        <input
          aria-label="Min selections"
          type="number"
          min="0"
          value={group.min_selections}
          onChange={e =>
            onUpdateGroup(groupIdx, {
              min_selections: Math.max(0, Number(e.target.value) || 0),
            })
          }
          disabled={saving}
          title="Minimum selections required (0 = optional)"
          className="w-14 rounded border border-border bg-background px-2 py-1 text-xs disabled:opacity-50"
        />
        <span className="text-[10px] text-muted-foreground">→</span>
        <input
          aria-label="Max selections"
          type="number"
          min="1"
          value={group.max_selections}
          disabled={saving || group.selection_type === 'single'}
          onChange={e =>
            onUpdateGroup(groupIdx, {
              max_selections: Math.max(1, Number(e.target.value) || 1),
            })
          }
          title="Maximum selections (locked to 1 for single-choice groups)"
          className="w-14 rounded border border-border bg-background px-2 py-1 text-xs disabled:opacity-50"
        />
        <label
          className="flex items-center gap-1 text-[11px] text-muted-foreground"
          title="Show this group prominently on the dish card in the mobile feed"
        >
          <input
            type="checkbox"
            checked={group.display_in_card}
            onChange={e => onUpdateGroup(groupIdx, { display_in_card: e.target.checked })}
            disabled={saving}
            className="h-3 w-3"
          />
          Card
        </label>
        <button
          type="button"
          onClick={() => onMoveGroup(groupIdx, groupIdx - 1)}
          disabled={saving || isFirst}
          aria-label="Move group up"
          className="rounded border border-border px-1.5 py-1 text-xs hover:bg-muted disabled:opacity-30"
        >
          ↑
        </button>
        <button
          type="button"
          onClick={() => onMoveGroup(groupIdx, groupIdx + 1)}
          disabled={saving || isLast}
          aria-label="Move group down"
          className="rounded border border-border px-1.5 py-1 text-xs hover:bg-muted disabled:opacity-30"
        >
          ↓
        </button>
        <button
          type="button"
          onClick={() => onRemoveGroup(groupIdx)}
          disabled={saving}
          aria-label="Remove group"
          className="rounded border border-border px-2 py-1 text-xs hover:bg-muted disabled:opacity-50"
        >
          ×
        </button>
      </div>

      <div className="pl-4 space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium text-muted-foreground">
            Options ({group.options.length})
          </span>
          <button
            type="button"
            onClick={() => onAddOption(groupIdx)}
            disabled={saving}
            className="rounded border border-border bg-background px-2 py-0.5 text-[11px] hover:bg-muted disabled:opacity-50"
          >
            + Add option
          </button>
        </div>

        {group.options.length === 0 ? (
          <p className="text-[10px] italic text-muted-foreground">
            Add the choices customers can pick from.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {group.options.map((option, optIdx) => (
              <OptionRow
                key={option._id}
                option={option}
                groupIdx={groupIdx}
                optIdx={optIdx}
                isFirst={optIdx === 0}
                isLast={optIdx === group.options.length - 1}
                saving={saving}
                currencySymbol={currencySymbol}
                onRemoveOption={onRemoveOption}
                onMoveOption={onMoveOption}
                onUpdateOption={onUpdateOption}
              />
            ))}
          </ul>
        )}
      </div>
    </li>
  );
}

interface OptionRowProps {
  option: EditableModifierOption;
  groupIdx: number;
  optIdx: number;
  isFirst: boolean;
  isLast: boolean;
  saving: boolean;
  currencySymbol: string;
  onRemoveOption: (groupIdx: number, optIdx: number) => void;
  onMoveOption: (groupIdx: number, from: number, to: number) => void;
  onUpdateOption: (
    groupIdx: number,
    optIdx: number,
    patch: Partial<EditableModifierOption>
  ) => void;
}

function OptionRow({
  option,
  groupIdx,
  optIdx,
  isFirst,
  isLast,
  saving,
  currencySymbol,
  onRemoveOption,
  onMoveOption,
  onUpdateOption,
}: OptionRowProps) {
  const [expanded, setExpanded] = useState(
    option.primary_protein != null || option.serves_delta !== 0
  );

  return (
    <li className="rounded border border-border bg-background/60 p-1.5 space-y-1.5">
      <div className="flex items-center gap-1.5">
        <input
          aria-label="Option name"
          value={option.name}
          onChange={e => onUpdateOption(groupIdx, optIdx, { name: e.target.value })}
          disabled={saving}
          placeholder="Option name"
          className="flex-1 rounded border border-border bg-background px-2 py-1 text-xs disabled:opacity-50"
        />
        <span className="text-[10px] text-muted-foreground">+</span>
        <div className="flex items-stretch rounded border border-border bg-background overflow-hidden w-20">
          <span className="px-1 flex items-center text-[10px] text-muted-foreground bg-muted/40 border-r border-border">
            {currencySymbol}
          </span>
          <input
            aria-label="Price delta"
            type="number"
            step="0.01"
            // Empty input == no surcharge (state 0). Rendering "" instead of "0"
            // lets the user clear the field; placeholder shows the implied default.
            value={option.price_delta || ''}
            onChange={e =>
              onUpdateOption(groupIdx, optIdx, {
                price_delta: e.target.value === '' ? 0 : Number(e.target.value) || 0,
              })
            }
            disabled={saving}
            placeholder="0"
            title="Surcharge above the dish base price (blank = no extra)"
            className="w-full min-w-0 bg-transparent px-1.5 py-1 text-xs focus:outline-none disabled:opacity-50"
          />
        </div>
        <span className="text-[10px] text-muted-foreground">or =</span>
        <div className="flex items-stretch rounded border border-border bg-background overflow-hidden w-20">
          <span className="px-1 flex items-center text-[10px] text-muted-foreground bg-muted/40 border-r border-border">
            {currencySymbol}
          </span>
          <input
            aria-label="Price override"
            type="number"
            step="0.01"
            min="0"
            value={option.price_override ?? ''}
            onChange={e =>
              onUpdateOption(groupIdx, optIdx, {
                price_override: e.target.value === '' ? null : Math.max(0, Number(e.target.value)),
              })
            }
            disabled={saving}
            placeholder="—"
            title="Absolute price (replaces the base price; leave blank to use delta)"
            className="w-full min-w-0 bg-transparent px-1.5 py-1 text-xs focus:outline-none disabled:opacity-50"
          />
        </div>
        <label
          className="flex items-center gap-1 text-[11px] text-muted-foreground"
          title="Pre-selected by default"
        >
          <input
            type="checkbox"
            checked={option.is_default}
            onChange={e => onUpdateOption(groupIdx, optIdx, { is_default: e.target.checked })}
            disabled={saving}
            className="h-3 w-3"
          />
          Default
        </label>
        <button
          type="button"
          onClick={() => setExpanded(v => !v)}
          aria-label={expanded ? 'Collapse advanced' : 'Expand advanced'}
          aria-expanded={expanded}
          className="rounded border border-border px-1.5 py-1 text-[11px] hover:bg-muted"
        >
          {expanded ? '▾' : '▸'}
        </button>
        <button
          type="button"
          onClick={() => onMoveOption(groupIdx, optIdx, optIdx - 1)}
          disabled={saving || isFirst}
          aria-label="Move option up"
          className="rounded border border-border px-1.5 py-1 text-[11px] hover:bg-muted disabled:opacity-30"
        >
          ↑
        </button>
        <button
          type="button"
          onClick={() => onMoveOption(groupIdx, optIdx, optIdx + 1)}
          disabled={saving || isLast}
          aria-label="Move option down"
          className="rounded border border-border px-1.5 py-1 text-[11px] hover:bg-muted disabled:opacity-30"
        >
          ↓
        </button>
        <button
          type="button"
          onClick={() => onRemoveOption(groupIdx, optIdx)}
          disabled={saving}
          aria-label="Remove option"
          className="rounded border border-border px-1.5 py-1 text-[11px] hover:bg-muted disabled:opacity-50"
        >
          ×
        </button>
      </div>

      {expanded && (
        <div className="grid grid-cols-2 gap-2 pl-1 text-[11px]">
          <label className="flex items-center gap-1.5">
            <span className="w-24 shrink-0 text-muted-foreground">Protein:</span>
            <select
              aria-label="Primary protein override"
              value={option.primary_protein ?? ''}
              onChange={e =>
                onUpdateOption(groupIdx, optIdx, {
                  primary_protein:
                    e.target.value === ''
                      ? null
                      : (e.target.value as (typeof PRIMARY_PROTEINS)[number]),
                })
              }
              disabled={saving}
              className="flex-1 rounded border border-border bg-background px-1.5 py-0.5 disabled:opacity-50"
            >
              <option value="">— inherit dish —</option>
              {PRIMARY_PROTEINS.map(p => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-1.5">
            <span className="w-24 shrink-0 text-muted-foreground">Serves Δ:</span>
            <input
              aria-label="Serves delta"
              type="number"
              value={option.serves_delta}
              onChange={e =>
                onUpdateOption(groupIdx, optIdx, {
                  serves_delta: Number(e.target.value) || 0,
                })
              }
              disabled={saving}
              title="How this option changes serving size (e.g. +1 for a larger portion)"
              className="flex-1 rounded border border-border bg-background px-1.5 py-0.5 disabled:opacity-50"
            />
          </label>
        </div>
      )}
    </li>
  );
}
