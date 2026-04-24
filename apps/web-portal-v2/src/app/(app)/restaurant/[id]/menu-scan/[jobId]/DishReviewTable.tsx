'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { confirmMenuScan } from '../../actions/menuScan';
import { createCategory } from '../../actions/category';
import type { MenuExtractionDish } from '@eatme/shared';

type Category = { id: string; name: string; menu_id: string };
type Menu = { id: string; name: string };

interface ReviewRow {
  index: number;
  accepted: boolean;
  name: string;
  description: string | null;
  price: string;
  dish_kind: 'standard' | 'bundle' | 'configurable' | 'course_menu' | 'buffet';
  primary_protein: string;
  suggested_category_name: string | null;
  confidence: number;
  menu_category_id: string | null;
}

interface Props {
  jobId: string;
  restaurantId: string;
  extractedDishes: MenuExtractionDish[];
  categories: Category[];
  menus: Menu[];
}

function confidenceLabel(c: number): { label: string; className: string } {
  if (c >= 0.8)
    return { label: `${Math.round(c * 100)}%`, className: 'bg-green-100 text-green-800' };
  if (c >= 0.5)
    return { label: `${Math.round(c * 100)}%`, className: 'bg-yellow-100 text-yellow-800' };
  return { label: `${Math.round(c * 100)}%`, className: 'bg-red-100 text-red-800' };
}

export function DishReviewTable({
  jobId,
  restaurantId,
  extractedDishes,
  categories: initialCategories,
  menus,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Idempotency key: generated once on mount; reused if confirm is retried
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sort by confidence ascending (low first) initially
  const [rows, setRows] = useState<ReviewRow[]>(() =>
    [...extractedDishes]
      .sort((a, b) => a.confidence - b.confidence)
      .map((d, i) => ({
        index: i,
        accepted: true,
        name: d.name,
        description: d.description,
        price: d.price !== null ? String(d.price) : '',
        dish_kind: d.dish_kind,
        primary_protein: d.primary_protein,
        suggested_category_name: d.suggested_category_name,
        confidence: d.confidence,
        menu_category_id: null,
      }))
  );

  // State for inline category creation per row
  const [newCatRow, setNewCatRow] = useState<{
    rowIndex: number;
    name: string;
    menuId: string;
  } | null>(null);
  const [creatingCat, startCatCreation] = useTransition();

  function updateRow(index: number, patch: Partial<ReviewRow>) {
    setRows(prev => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function acceptAllAbove80() {
    setRows(prev => prev.map(r => ({ ...r, accepted: r.confidence >= 0.8 })));
  }

  function acceptAll() {
    setRows(prev => prev.map(r => ({ ...r, accepted: true })));
  }

  const acceptedRows = rows.filter(r => r.accepted);
  const allAssigned =
    acceptedRows.length > 0 && acceptedRows.every(r => r.menu_category_id !== null);

  function handleCreateCategory(rowIndex: number) {
    if (!newCatRow || newCatRow.rowIndex !== rowIndex) return;
    if (!newCatRow.name.trim() || !newCatRow.menuId) return;

    startCatCreation(async () => {
      const result = await createCategory(restaurantId, {
        menu_id: newCatRow.menuId,
        name: newCatRow.name.trim(),
      });
      if (result.ok) {
        const newCat: Category = {
          id: result.data.id,
          name: newCatRow.name.trim(),
          menu_id: newCatRow.menuId,
        };
        setCategories(prev => [...prev, newCat]);
        updateRow(rowIndex, { menu_category_id: result.data.id });
        setNewCatRow(null);
      }
    });
  }

  function handleConfirm() {
    setErrorMessage(null);
    startTransition(async () => {
      const payload = {
        job_id: jobId,
        idempotency_key: idempotencyKey,
        dishes: acceptedRows.map(r => ({
          menu_category_id: r.menu_category_id!,
          name: r.name,
          description: r.description ?? null,
          price: parseFloat(r.price) || 0,
          dish_kind: r.dish_kind,
          primary_protein: r.primary_protein as Parameters<
            typeof confirmMenuScan
          >[0]['dishes'][0]['primary_protein'],
          is_template: false,
        })),
      };

      const result = await confirmMenuScan(payload);
      if (result.ok) {
        router.push(`/restaurant/${restaurantId}/menu`);
      } else {
        setErrorMessage(result.formError ?? 'Confirm failed. Please try again.');
      }
    });
  }

  if (extractedDishes.length === 0) {
    return (
      <div className="rounded-lg border border-border p-6 text-center">
        <p className="text-muted-foreground">No dishes were extracted from this scan.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {acceptedRows.length} of {rows.length} dishes accepted
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={acceptAllAbove80}
            className="text-xs rounded border border-border px-3 py-1 hover:bg-muted"
          >
            Accept above 80%
          </button>
          <button
            type="button"
            onClick={acceptAll}
            className="text-xs rounded border border-border px-3 py-1 hover:bg-muted"
          >
            Accept all
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="w-8 px-3 py-2 text-left font-medium">✓</th>
              <th className="px-3 py-2 text-left font-medium">Name</th>
              <th className="px-3 py-2 text-left font-medium w-20">Price</th>
              <th className="px-3 py-2 text-left font-medium">Category</th>
              <th className="px-3 py-2 text-left font-medium w-16">Conf.</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row, i) => {
              const conf = confidenceLabel(row.confidence);
              return (
                <tr key={row.index} className={row.accepted ? '' : 'opacity-40'}>
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={row.accepted}
                      onChange={e => updateRow(i, { accepted: e.target.checked })}
                      aria-label={`Accept dish ${row.name}`}
                      className="h-4 w-4"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      value={row.name}
                      onChange={e => updateRow(i, { name: e.target.value })}
                      className="w-full rounded border border-border bg-background px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                      aria-label="Dish name"
                    />
                    {row.suggested_category_name && !row.menu_category_id && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Suggested: {row.suggested_category_name}
                      </p>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      value={row.price}
                      onChange={e => updateRow(i, { price: e.target.value })}
                      min="0"
                      step="0.01"
                      className="w-full rounded border border-border bg-background px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                      aria-label="Price"
                    />
                  </td>
                  <td className="px-3 py-2 space-y-1">
                    <select
                      value={row.menu_category_id ?? ''}
                      onChange={e => {
                        if (e.target.value === '__new__') {
                          setNewCatRow({ rowIndex: i, name: '', menuId: menus[0]?.id ?? '' });
                          updateRow(i, { menu_category_id: null });
                        } else {
                          updateRow(i, { menu_category_id: e.target.value || null });
                          setNewCatRow(null);
                        }
                      }}
                      className="w-full rounded border border-border bg-background px-2 py-1 text-sm"
                      aria-label="Category"
                    >
                      <option value="">— Select category —</option>
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                      {menus.length > 0 && <option value="__new__">+ Create new category…</option>}
                    </select>

                    {newCatRow?.rowIndex === i && (
                      <div className="flex gap-1 items-center">
                        <input
                          type="text"
                          placeholder="Category name"
                          value={newCatRow.name}
                          onChange={e =>
                            setNewCatRow(prev => (prev ? { ...prev, name: e.target.value } : null))
                          }
                          className="flex-1 rounded border border-border bg-background px-2 py-1 text-xs"
                          aria-label="New category name"
                        />
                        {menus.length > 1 && (
                          <select
                            value={newCatRow.menuId}
                            onChange={e =>
                              setNewCatRow(prev =>
                                prev ? { ...prev, menuId: e.target.value } : null
                              )
                            }
                            className="rounded border border-border bg-background px-2 py-1 text-xs"
                            aria-label="Menu for new category"
                          >
                            {menus.map(m => (
                              <option key={m.id} value={m.id}>
                                {m.name}
                              </option>
                            ))}
                          </select>
                        )}
                        <button
                          type="button"
                          onClick={() => handleCreateCategory(i)}
                          disabled={creatingCat || !newCatRow.name.trim()}
                          className="text-xs rounded bg-primary px-2 py-1 text-primary-foreground disabled:opacity-50"
                        >
                          {creatingCat ? '…' : 'Create'}
                        </button>
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${conf.className}`}
                    >
                      {conf.label}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {errorMessage && (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage}
        </p>
      )}

      <button
        type="button"
        onClick={handleConfirm}
        disabled={isPending || !allAssigned}
        className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        aria-disabled={isPending || !allAssigned}
      >
        {isPending
          ? 'Confirming…'
          : `Confirm ${acceptedRows.length} dish${acceptedRows.length !== 1 ? 'es' : ''}`}
      </button>

      {acceptedRows.length > 0 && !allAssigned && (
        <p className="text-xs text-muted-foreground text-center">
          Assign a category to every accepted dish before confirming.
        </p>
      )}
    </div>
  );
}
