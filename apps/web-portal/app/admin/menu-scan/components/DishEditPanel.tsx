'use client';

import { AlertTriangle, Layers, Loader2, Plus, Sparkles, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { getDietaryTagIcon, getAllergenIcon } from '@/lib/icons';
import { InlineIngredientSearch } from '@/components/admin/InlineIngredientSearch';
import { createDishCategory } from '@/lib/dish-categories';
import type { EditableDish } from '@/lib/menu-scan';
import { useReviewStore } from '../store';

export interface DishEditPanelProps {
  dish: EditableDish;
  mIdx: number;
  cIdx: number;
  dIdx: number;
}

export function DishEditPanel({ dish, mIdx, cIdx, dIdx }: DishEditPanelProps) {
  const dietaryTags = useReviewStore(s => s.dietaryTags);
  const dishCategories = useReviewStore(s => s.dishCategories);
  const setDishCategories = useReviewStore(s => s.setDishCategories);
  const suggestingDishId = useReviewStore(s => s.suggestingDishId);
  const suggestIngredients = useReviewStore(s => s.suggestIngredients);
  const inlineSearchTarget = useReviewStore(s => s.inlineSearchTarget);
  const setInlineSearchTarget = useReviewStore(s => s.setInlineSearchTarget);
  const subIngredientEditTarget = useReviewStore(s => s.subIngredientEditTarget);
  const setSubIngredientEditTarget = useReviewStore(s => s.setSubIngredientEditTarget);
  const setAddIngredientTarget = useReviewStore(s => s.setAddIngredientTarget);
  const updateDish = useReviewStore(s => s.updateDish);
  const addIngredientToDish = useReviewStore(s => s.addIngredientToDish);
  const removeIngredientFromDish = useReviewStore(s => s.removeIngredientFromDish);
  const addSubIngredient = useReviewStore(s => s.addSubIngredient);
  const removeSubIngredient = useReviewStore(s => s.removeSubIngredient);

  return (
    <div className="mt-3 space-y-3 pl-1">
      {/* Description */}
      <textarea
        value={dish.description}
        onChange={e => updateDish(mIdx, cIdx, dIdx, { description: e.target.value })}
        rows={2}
        placeholder="Description (optional)"
        className="w-full text-sm border border-input rounded px-3 py-2 resize-none focus:outline-none focus:border-brand-primary/70"
      />

      {/* Dish kind, serves, display_price_prefix */}
      <div className="flex items-center gap-3 flex-wrap">
        <label className="flex items-center gap-1 text-xs text-muted-foreground">
          Kind:
          <select
            value={dish.dish_kind ?? 'standard'}
            onChange={e => {
              const newKind = e.target.value as EditableDish['dish_kind'];
              const patch: Partial<EditableDish> = { dish_kind: newKind };
              if (newKind === 'template') {
                patch.is_parent = true;
                patch.display_price_prefix = 'from';
              } else if (newKind === 'experience') {
                patch.is_parent = true;
                patch.display_price_prefix = 'per_person';
              } else if (newKind === 'combo') {
                patch.is_parent = true;
                patch.display_price_prefix = 'exact';
              } else {
                patch.is_parent = false;
                patch.display_price_prefix = 'exact';
              }
              updateDish(mIdx, cIdx, dIdx, patch);
            }}
            className="text-xs border rounded px-1 py-0.5"
          >
            <option value="standard">Standard</option>
            <option value="template">Template</option>
            <option value="combo">Combo</option>
            <option value="experience">Experience</option>
          </select>
        </label>
        <label className="flex items-center gap-1 text-xs text-muted-foreground">
          Serves:
          <input
            type="number"
            min="1"
            value={dish.serves ?? 1}
            onChange={e =>
              updateDish(mIdx, cIdx, dIdx, {
                serves: parseInt(e.target.value) || 1,
              })
            }
            className="w-12 text-xs border rounded px-1 py-0.5 text-center"
          />
        </label>
        <label className="flex items-center gap-1 text-xs text-muted-foreground">
          Price:
          <select
            value={dish.display_price_prefix ?? 'exact'}
            onChange={e =>
              updateDish(mIdx, cIdx, dIdx, {
                display_price_prefix: e.target.value as EditableDish['display_price_prefix'],
              })
            }
            className="text-xs border rounded px-1 py-0.5"
          >
            <option value="exact">Exact</option>
            <option value="from">From</option>
            <option value="per_person">Per person</option>
            <option value="market_price">Market price</option>
            <option value="ask_server">Ask server</option>
          </select>
        </label>
        {dish.is_parent && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-info/10 text-info">
            Parent ({dish.variant_ids?.length ?? 0} variants)
          </span>
        )}
        {dish.parent_id && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted/30 text-muted-foreground">
            Variant
          </span>
        )}
      </div>

      {/* Dietary tags */}
      {dietaryTags.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground mb-1.5">Dietary Tags</p>
          <div className="flex flex-wrap gap-1.5">
            {dietaryTags.map(tag => {
              const active = dish.dietary_tags.includes(tag.code);
              return (
                <button
                  key={tag.code}
                  type="button"
                  onClick={() => {
                    const next = active
                      ? dish.dietary_tags.filter(c => c !== tag.code)
                      : [...dish.dietary_tags, tag.code];
                    updateDish(mIdx, cIdx, dIdx, { dietary_tags: next });
                  }}
                  className={cn(
                    'text-xs px-2 py-0.5 rounded-full border transition-colors',
                    active
                      ? 'bg-success/10 border-success/30 text-success'
                      : 'bg-background border text-muted-foreground hover:border-input'
                  )}
                >
                  <span className="mr-0.5">{getDietaryTagIcon(tag.code)}</span>
                  {tag.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Ingredients */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-xs text-muted-foreground">Ingredients</p>
          <div className="flex items-center gap-1">
            {/* AI Suggest */}
            <button
              type="button"
              disabled={suggestingDishId === dish._id}
              onClick={() =>
                suggestIngredients(dish._id, dish.name, dish.description, mIdx, cIdx, dIdx)
              }
              className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border border-purple-200 text-purple-700 bg-purple-50 hover:bg-purple-100 disabled:opacity-50 transition-colors"
              title="Suggest ingredients from dish name & description"
            >
              {suggestingDishId === dish._id ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Sparkles className="h-3 w-3" />
              )}
              Suggest
            </button>
            {/* Inline Add */}
            {!(
              inlineSearchTarget?.mIdx === mIdx &&
              inlineSearchTarget?.cIdx === cIdx &&
              inlineSearchTarget?.dIdx === dIdx
            ) && (
              <button
                type="button"
                onClick={() => setInlineSearchTarget({ mIdx, cIdx, dIdx })}
                className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border border-brand-primary/20 text-brand-primary bg-brand-primary/5 hover:bg-brand-primary/10 transition-colors"
              >
                <Plus className="h-3 w-3" />
                Add
              </button>
            )}
          </div>
        </div>

        {/* Ingredient pills */}
        {dish.ingredients.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-1.5">
            {dish.ingredients.map((ing, ingIdx) => {
              const matched = ing.status === 'matched';
              const hasSubs = (ing.sub_ingredients?.length ?? 0) > 0;
              const isVariantActive =
                matched &&
                subIngredientEditTarget?.mIdx === mIdx &&
                subIngredientEditTarget?.cIdx === cIdx &&
                subIngredientEditTarget?.dIdx === dIdx &&
                subIngredientEditTarget?.ingIdx === ingIdx;

              return (
                <div
                  key={ingIdx}
                  className={cn(
                    'text-xs rounded-full flex items-center',
                    matched
                      ? 'bg-muted/30 text-foreground'
                      : 'bg-brand-primary/5 text-brand-primary border border-brand-primary/20'
                  )}
                >
                  {/* Pill body — opens re-link / link panel */}
                  <button
                    type="button"
                    onClick={() =>
                      setAddIngredientTarget({
                        menuIdx: mIdx,
                        catIdx: cIdx,
                        dishIdx: dIdx,
                        rawText: matched ? ing.display_name || ing.raw_text : ing.raw_text,
                      })
                    }
                    className={cn(
                      'flex items-center gap-1 pl-2 pr-0.5 py-0.5 rounded-l-full transition-colors',
                      matched ? 'hover:bg-muted' : 'hover:bg-brand-primary/10'
                    )}
                    title={matched ? `Re-link: ${ing.canonical_name}` : 'Link to ingredient'}
                  >
                    {!matched && <AlertTriangle className="h-3 w-3 shrink-0" />}
                    {hasSubs && <Layers className="h-2.5 w-2.5 text-indigo-400 shrink-0" />}
                    <span>{ing.display_name || ing.raw_text}</span>
                    {hasSubs && (
                      <span className="text-indigo-400 text-[10px]">
                        ({ing.sub_ingredients!.length})
                      </span>
                    )}
                  </button>
                  {/* Variant toggle (matched only) */}
                  {matched && (
                    <button
                      type="button"
                      onClick={() =>
                        setSubIngredientEditTarget(
                          isVariantActive ? null : { mIdx, cIdx, dIdx, ingIdx }
                        )
                      }
                      className={cn(
                        'px-0.5 py-0.5 transition-colors',
                        isVariantActive
                          ? 'text-indigo-500 bg-indigo-50 rounded'
                          : 'text-muted-foreground hover:text-indigo-500'
                      )}
                      title="Add/edit variants (e.g., choice of meat)"
                    >
                      <Layers className="h-2.5 w-2.5" />
                    </button>
                  )}
                  {/* Delete ingredient */}
                  <button
                    type="button"
                    onClick={() => removeIngredientFromDish(mIdx, cIdx, dIdx, ingIdx)}
                    className={cn(
                      'flex items-center pr-1.5 py-0.5 rounded-r-full transition-colors',
                      matched
                        ? 'text-muted-foreground hover:text-destructive hover:bg-destructive/10'
                        : 'text-brand-primary/30 hover:text-destructive hover:bg-destructive/10'
                    )}
                    title="Remove ingredient"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Sub-ingredient / variant editor */}
        {(() => {
          if (
            !subIngredientEditTarget ||
            subIngredientEditTarget.mIdx !== mIdx ||
            subIngredientEditTarget.cIdx !== cIdx ||
            subIngredientEditTarget.dIdx !== dIdx
          )
            return null;
          const parentIngIdx = subIngredientEditTarget.ingIdx;
          const parentIng = dish.ingredients[parentIngIdx];
          if (!parentIng || parentIng.status !== 'matched') return null;
          const subs = parentIng.sub_ingredients ?? [];
          return (
            <div className="border border-indigo-200 bg-indigo-50/40 rounded-lg p-2 mb-1.5">
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-xs text-indigo-600 font-medium flex items-center gap-1">
                  <Layers className="h-3 w-3" />
                  Variants of &ldquo;{parentIng.display_name || parentIng.raw_text}&rdquo;
                </p>
                <button
                  type="button"
                  onClick={() => setSubIngredientEditTarget(null)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              {subs.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-1.5">
                  {subs.map((sub, subIdx) => (
                    <div
                      key={subIdx}
                      className="text-xs bg-indigo-100 text-indigo-700 rounded-full flex items-center"
                    >
                      <span className="pl-2 pr-0.5 py-0.5">{sub.display_name || sub.raw_text}</span>
                      <button
                        type="button"
                        onClick={() => removeSubIngredient(mIdx, cIdx, dIdx, parentIngIdx, subIdx)}
                        className="pr-1.5 py-0.5 text-indigo-400 hover:text-destructive rounded-r-full transition-colors"
                        title="Remove variant"
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-[10px] text-indigo-400 mb-1">
                Search for specific variants (e.g., beef, chicken, pork)
              </p>
              <InlineIngredientSearch
                existingIds={
                  new Set([
                    ...(parentIng.canonical_ingredient_id
                      ? [parentIng.canonical_ingredient_id]
                      : []),
                    ...subs
                      .map(s => s.canonical_ingredient_id)
                      .filter((id): id is string => Boolean(id)),
                  ])
                }
                onAdd={sub => addSubIngredient(mIdx, cIdx, dIdx, parentIngIdx, sub)}
                onClose={() => setSubIngredientEditTarget(null)}
              />
            </div>
          );
        })()}

        {/* Inline ingredient search */}
        {inlineSearchTarget?.mIdx === mIdx &&
          inlineSearchTarget?.cIdx === cIdx &&
          inlineSearchTarget?.dIdx === dIdx && (
            <InlineIngredientSearch
              existingIds={
                new Set(
                  dish.ingredients
                    .map(i => i.canonical_ingredient_id)
                    .filter((id): id is string => Boolean(id))
                )
              }
              onAdd={ing => {
                addIngredientToDish(mIdx, cIdx, dIdx, ing);
              }}
              onClose={() => setInlineSearchTarget(null)}
            />
          )}

        {/* AI allergen hints */}
        {(dish.suggested_allergens ?? []).length > 0 && (
          <div className="flex flex-wrap items-center gap-1 mt-1.5 pt-1.5 border-t">
            <span className="text-xs text-muted-foreground mr-0.5">AI hints:</span>
            {dish.suggested_allergens!.map(code => (
              <span
                key={code}
                className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full"
                title="AI-suggested allergen — confirmed automatically from matched ingredients on save"
              >
                {getAllergenIcon(code)} {code.replace(/_/g, ' ')}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Primary Protein */}
      <div>
        <p className="text-xs text-muted-foreground mb-1">Primary Protein</p>
        <select
          value={dish.primary_protein ?? ''}
          onChange={e =>
            updateDish(mIdx, cIdx, dIdx, {
              primary_protein: e.target.value || null,
            })
          }
          className="w-full text-xs border border-input rounded px-2 py-1.5 bg-background focus:outline-none focus:border-brand-primary/70"
        >
          <option value="">— Not specified —</option>
          <optgroup label="Meat">
            <option value="chicken">Chicken</option>
            <option value="beef">Beef</option>
            <option value="pork">Pork</option>
            <option value="lamb">Lamb</option>
            <option value="duck">Duck</option>
            <option value="other_meat">Other meat</option>
          </optgroup>
          <optgroup label="Fish &amp; Seafood">
            <option value="fish">Fish</option>
            <option value="shellfish">Seafood</option>
          </optgroup>
          <optgroup label="Other Animal">
            <option value="eggs">Eggs</option>
          </optgroup>
          <optgroup label="Plant-Based">
            <option value="vegetarian">Vegetarian</option>
            <option value="vegan">Vegan</option>
          </optgroup>
        </select>
      </div>

      {/* Dish category + extra fields row */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-40">
          <p className="text-xs text-muted-foreground mb-1">Dish Category</p>
          <select
            value={dish.dish_category_id ?? ''}
            onChange={async e => {
              const val = e.target.value;
              if (val === '__new__') {
                const name = prompt('New category name:');
                if (!name?.trim()) return;
                const { data: created, error } = await createDishCategory({
                  name: name.trim(),
                  is_drink: false,
                });
                if (error || !created) {
                  toast.error(`Failed to create category: ${error?.message ?? 'unknown'}`);
                  return;
                }
                setDishCategories(prev =>
                  [...prev, created].sort((a, b) => a.name.localeCompare(b.name))
                );
                updateDish(mIdx, cIdx, dIdx, { dish_category_id: created.id });
                toast.success(`Category "${created.name}" created`);
              } else {
                updateDish(mIdx, cIdx, dIdx, { dish_category_id: val || null });
              }
            }}
            className="w-full text-xs border border-input rounded px-2 py-1.5 bg-background focus:outline-none focus:border-brand-primary/70"
          >
            <option value="">— None —</option>
            {dishCategories.map(dc => (
              <option key={dc.id} value={dc.id}>
                {dc.name}
              </option>
            ))}
            <option value="__new__">➕ New category…</option>
          </select>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">Spice</p>
          <select
            value={dish.spice_level ?? ''}
            onChange={e =>
              updateDish(mIdx, cIdx, dIdx, {
                spice_level:
                  e.target.value === '' ? null : (e.target.value as 'none' | 'mild' | 'hot'),
              })
            }
            className="text-xs border border-input rounded px-2 py-1.5 bg-background focus:outline-none focus:border-brand-primary/70"
          >
            <option value="">—</option>
            <option value="none">No spice</option>
            <option value="mild">🌶️</option>
            <option value="hot">🌶️🌶️🌶️</option>
          </select>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">Calories</p>
          <input
            type="number"
            value={dish.calories ?? ''}
            onChange={e =>
              updateDish(mIdx, cIdx, dIdx, {
                calories: e.target.value ? Number(e.target.value) : null,
              })
            }
            className="w-20 text-xs border border-input rounded px-2 py-1.5 focus:outline-none focus:border-brand-primary/70"
            placeholder="kcal"
            min="0"
          />
        </div>
      </div>
    </div>
  );
}
