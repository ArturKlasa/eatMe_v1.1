'use client';

import { useFormContext, useWatch } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DISPLAY_PRICE_PREFIXES,
  SELECTION_TYPES,
  OPTION_PRESETS,
} from '@/lib/constants';
import { Plus, Trash2, ChevronUp, ChevronDown } from 'lucide-react';
import type { OptionGroup } from '@/types/restaurant';
import type { DishFormData } from '@/lib/validation';

interface DishOptionsSectionProps {
  optionGroups: OptionGroup[];
  onOptionGroupsChange: (groups: OptionGroup[]) => void;
}

export function DishOptionsSection({
  optionGroups,
  onOptionGroupsChange,
}: DishOptionsSectionProps) {
  const { setValue, control } = useFormContext<DishFormData>();
  const dishKind = useWatch({ control, name: 'dish_kind', defaultValue: 'standard' });
  const displayPricePrefix = useWatch({
    control,
    name: 'display_price_prefix',
    defaultValue: 'exact',
  });

  if (
    dishKind !== 'template' &&
    dishKind !== 'experience' &&
    dishKind !== 'combo' &&
    dishKind !== 'standard'
  ) {
    return null;
  }

  return (
    <>
      <Separator />
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Price Display</h3>
        <Select
          value={(displayPricePrefix as string) ?? 'exact'}
          onValueChange={val =>
            setValue(
              'display_price_prefix',
              val as 'exact' | 'from' | 'per_person' | 'market_price' | 'ask_server'
            )
          }
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select price format" />
          </SelectTrigger>
          <SelectContent>
            {DISPLAY_PRICE_PREFIXES.map(p => (
              <SelectItem key={p.value} value={p.value}>
                <span className="font-medium">{p.label}</span>
                <span className="ml-2 text-xs text-muted-foreground">{p.example}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Separator />

      {/* Option Groups Editor */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">
            Option Groups
            {optionGroups.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {optionGroups.length}
              </Badge>
            )}
          </h3>
        </div>

        {/* Preset picker */}
        {optionGroups.length === 0 && (
          <div>
            <p className="text-xs text-muted-foreground mb-2">
              Start from a preset or add groups manually:
            </p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(OPTION_PRESETS).map(([key, preset]) => (
                <Button
                  key={key}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() =>
                    onOptionGroupsChange(
                      preset.groups.map((g, i) => ({
                        name: g.name,
                        selection_type: g.selection_type,
                        min_selections: g.min_selections,
                        max_selections: g.max_selections,
                        display_order: i,
                        is_active: true,
                        options: [],
                      }))
                    )
                  }
                >
                  {preset.label}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Groups list */}
        <div className="space-y-4">
          {optionGroups.map((group, gi) => (
            <div key={gi} className="rounded-lg border p-3 space-y-3 bg-muted/30">
              {/* Group header */}
              <div className="flex items-center gap-2">
                <Input
                  value={group.name}
                  onChange={e =>
                    onOptionGroupsChange(
                      optionGroups.map((g, i) =>
                        i === gi ? { ...g, name: e.target.value } : g
                      )
                    )
                  }
                  placeholder="Group name (e.g. Protein)"
                  className="flex-1 text-sm h-8"
                />
                <Select
                  value={group.selection_type}
                  onValueChange={val =>
                    onOptionGroupsChange(
                      optionGroups.map((g, i) =>
                        i === gi
                          ? {
                              ...g,
                              selection_type: val as 'single' | 'multiple' | 'quantity',
                            }
                          : g
                      )
                    )
                  }
                >
                  <SelectTrigger className="w-36 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SELECTION_TYPES.map(st => (
                      <SelectItem key={st.value} value={st.value} className="text-xs">
                        {st.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {/* Min/Max selections */}
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    min={0}
                    value={group.min_selections ?? 0}
                    onChange={e =>
                      onOptionGroupsChange(
                        optionGroups.map((g, i) =>
                          i === gi ? { ...g, min_selections: Number(e.target.value) } : g
                        )
                      )
                    }
                    className="w-12 h-8 text-xs text-center"
                    title="Min selections"
                  />
                  <span className="text-xs text-muted-foreground">–</span>
                  <Input
                    type="number"
                    min={1}
                    placeholder="∞"
                    value={group.max_selections ?? ''}
                    onChange={e =>
                      onOptionGroupsChange(
                        optionGroups.map((g, i) =>
                          i === gi
                            ? {
                                ...g,
                                max_selections: e.target.value
                                  ? Number(e.target.value)
                                  : null,
                              }
                            : g
                        )
                      )
                    }
                    className="w-12 h-8 text-xs text-center"
                    title="Max selections (blank = unlimited)"
                  />
                </div>
                {/* Reorder */}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  disabled={gi === 0}
                  onClick={() => {
                    const next = [...optionGroups];
                    [next[gi - 1], next[gi]] = [next[gi], next[gi - 1]];
                    onOptionGroupsChange(next);
                  }}
                >
                  <ChevronUp className="h-3 w-3" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  disabled={gi === optionGroups.length - 1}
                  onClick={() => {
                    const next = [...optionGroups];
                    [next[gi], next[gi + 1]] = [next[gi + 1], next[gi]];
                    onOptionGroupsChange(next);
                  }}
                >
                  <ChevronDown className="h-3 w-3" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={() =>
                    onOptionGroupsChange(optionGroups.filter((_, i) => i !== gi))
                  }
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>

              {/* Options list */}
              <div className="space-y-2 pl-2">
                {group.options.map((opt, oi) => (
                  <div key={oi} className="flex items-center gap-2">
                    <Input
                      value={opt.name}
                      onChange={e =>
                        onOptionGroupsChange(
                          optionGroups.map((g, i) =>
                            i === gi
                              ? {
                                  ...g,
                                  options: g.options.map((o, j) =>
                                    j === oi ? { ...o, name: e.target.value } : o
                                  ),
                                }
                              : g
                          )
                        )
                      }
                      placeholder="Option name"
                      className="flex-1 h-7 text-xs"
                    />
                    <span className="text-xs text-muted-foreground">+$</span>
                    <Input
                      type="number"
                      step="0.01"
                      value={opt.price_delta}
                      onChange={e =>
                        onOptionGroupsChange(
                          optionGroups.map((g, i) =>
                            i === gi
                              ? {
                                  ...g,
                                  options: g.options.map((o, j) =>
                                    j === oi
                                      ? { ...o, price_delta: Number(e.target.value) }
                                      : o
                                  ),
                                }
                              : g
                          )
                        )
                      }
                      className="w-16 h-7 text-xs text-right"
                      title="Price delta (+ or -)"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() =>
                        onOptionGroupsChange(
                          optionGroups.map((g, i) =>
                            i === gi
                              ? { ...g, options: g.options.filter((_, j) => j !== oi) }
                              : g
                          )
                        )
                      }
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
                {/* Add option */}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-xs h-7 w-full"
                  onClick={() =>
                    onOptionGroupsChange(
                      optionGroups.map((g, i) =>
                        i === gi
                          ? {
                              ...g,
                              options: [
                                ...g.options,
                                {
                                  name: '',
                                  price_delta: 0,
                                  is_available: true,
                                  display_order: g.options.length,
                                },
                              ],
                            }
                          : g
                      )
                    )
                  }
                >
                  <Plus className="h-3 w-3 mr-1" /> Add option
                </Button>
              </div>
            </div>
          ))}

          {/* Add group */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() =>
              onOptionGroupsChange([
                ...optionGroups,
                {
                  name: '',
                  selection_type: 'single',
                  min_selections: 1,
                  max_selections: 1,
                  display_order: optionGroups.length,
                  is_active: true,
                  options: [],
                },
              ])
            }
          >
            <Plus className="h-4 w-4 mr-1" /> Add option group
          </Button>
        </div>
      </div>
    </>
  );
}
