'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import {
  createDishCategory,
  updateDishCategory,
  deleteDishCategory,
  type DishCategory,
  type DishCategoryInsert,
} from '@/lib/dish-categories';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Pencil, Trash2, Plus, Search, UtensilsCrossed, GlassWater, Tag } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const EMPTY_FORM: DishCategoryInsert = {
  name: '',
  parent_category_id: null,
  is_drink: false,
  is_active: true,
};

// ─────────────────────────────────────────────────────────────────────────────
export default function DishCategoriesPage() {
  const [categories, setCategories] = useState<DishCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'food' | 'drink'>('food');
  const [searchQuery, setSearchQuery] = useState('');

  // Form / dialog state
  const [formOpen, setFormOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<DishCategory | null>(null);
  const [formData, setFormData] = useState<DishCategoryInsert>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<DishCategory | null>(null);

  // ── Load ──────────────────────────────────────────────────────────────────
  const loadCategories = async () => {
    setLoading(true);
    // Fetch all (including inactive) for admin view
    const { data, error } = await supabase
      .from('dish_categories')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      console.error('[DishCategories] Load error:', error);
      toast.error('Failed to load categories');
    } else {
      setCategories(data ?? []);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadCategories();
  }, []);

  // ── Filtered list ─────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return categories.filter(c => {
      const matchesTab = activeTab === 'drink' ? c.is_drink : !c.is_drink;
      const matchesSearch = !q || c.name.toLowerCase().includes(q);
      return matchesTab && matchesSearch;
    });
  }, [categories, activeTab, searchQuery]);

  // ── Open add / edit form ──────────────────────────────────────────────────
  const openAdd = () => {
    setEditingCategory(null);
    setFormData({ ...EMPTY_FORM, is_drink: activeTab === 'drink' });
    setFormOpen(true);
  };

  const openEdit = (cat: DishCategory) => {
    setEditingCategory(cat);
    setFormData({
      name: cat.name,
      parent_category_id: cat.parent_category_id ?? null,
      is_drink: cat.is_drink,
      is_active: cat.is_active,
    });
    setFormOpen(true);
  };

  // ── Save (create or update) ───────────────────────────────────────────────
  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error('Category name is required');
      return;
    }

    setSaving(true);
    try {
      if (editingCategory) {
        const { error } = await updateDishCategory(editingCategory.id, formData);
        if (error) throw error;
        toast.success('Category updated');
      } else {
        const { error } = await createDishCategory(formData);
        if (error) throw error;
        toast.success('Category created');
      }
      setFormOpen(false);
      await loadCategories();
    } catch (err: unknown) {
      console.error('[DishCategories] Save error:', err);
      const msg = err instanceof Error ? err.message : 'Unknown error';
      toast.error('Failed to save: ' + msg);
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const { error } = await deleteDishCategory(deleteTarget.id);
      if (error) throw error;
      toast.success('Category deleted');
      setDeleteTarget(null);
      await loadCategories();
    } catch (err: unknown) {
      console.error('[DishCategories] Delete error:', err);
      const msg = err instanceof Error ? err.message : 'Unknown error';
      toast.error('Failed to delete: ' + msg);
    }
  };

  // ── Toggle active ─────────────────────────────────────────────────────────
  const toggleActive = async (cat: DishCategory) => {
    try {
      const { error } = await updateDishCategory(cat.id, { is_active: !cat.is_active });
      if (error) throw error;
      setCategories(prev =>
        prev.map(c => (c.id === cat.id ? { ...c, is_active: !c.is_active } : c))
      );
      toast.success(cat.is_active ? 'Category hidden' : 'Category activated');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      toast.error('Failed to update: ' + msg);
    }
  };

  // ── Parent categories for the dropdown (same drink/food type, not self) ───
  const parentOptions = categories.filter(
    c => c.is_drink === formData.is_drink && c.id !== editingCategory?.id
  );

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 max-w-5xl mx-auto">
      <PageHeader
        title="Dish Categories"
        description="Manage canonical dish categories (e.g. Pizza, Pasta, Cocktails). Restaurant owners assign these when adding dishes; the mobile app uses them for recommendations."
      />

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-card rounded-lg border p-4 text-center">
          <p className="text-2xl font-bold text-brand-primary">{categories.length}</p>
          <p className="text-xs text-muted-foreground">Total Categories</p>
        </div>
        <div className="bg-card rounded-lg border p-4 text-center">
          <p className="text-2xl font-bold text-success">
            {categories.filter(c => !c.is_drink && c.is_active).length}
          </p>
          <p className="text-xs text-muted-foreground">Active Food</p>
        </div>
        <div className="bg-card rounded-lg border p-4 text-center">
          <p className="text-2xl font-bold text-info">
            {categories.filter(c => c.is_drink && c.is_active).length}
          </p>
          <p className="text-xs text-muted-foreground">Active Drink</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-card rounded-lg border p-4 mb-4">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          {/* Tab switcher */}
          <div className="flex rounded-md border overflow-hidden">
            <button
              onClick={() => setActiveTab('food')}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === 'food'
                  ? 'bg-brand-primary/5 text-brand-primary border-r border-brand-primary/20'
                  : 'text-muted-foreground hover:bg-accent border-r'
              }`}
            >
              <UtensilsCrossed className="h-4 w-4" />
              Food ({categories.filter(c => !c.is_drink).length})
            </button>
            <button
              onClick={() => setActiveTab('drink')}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === 'drink'
                  ? 'bg-info/10 text-info'
                  : 'text-muted-foreground hover:bg-accent'
              }`}
            >
              <GlassWater className="h-4 w-4" />
              Drinks ({categories.filter(c => c.is_drink).length})
            </button>
          </div>

          <div className="flex gap-2 w-full sm:w-auto">
            {/* Search */}
            <div className="relative flex-1 sm:w-56">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search categories…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>
            <Button onClick={openAdd}>
              <Plus className="h-4 w-4 mr-2" />
              Add Category
            </Button>
          </div>
        </div>
      </div>

      {/* Category table */}
      <div className="bg-card rounded-lg border overflow-hidden">
        {loading ? (
          <div className="p-4">
            <LoadingSkeleton variant="table" count={5} />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Tag}
            title="No categories found"
            description={searchQuery ? 'Try a different search term.' : 'Add your first category above.'}
            action={!searchQuery ? { label: 'Add Category', onClick: openAdd } : undefined}
          />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/30 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Name</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map(cat => (
                <tr key={cat.id} className="hover:bg-accent transition-colors">
                  <td className="px-4 py-3 font-medium">
                    {cat.name}
                    {cat.parent_category_id && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        ↳{' '}
                        {categories.find(c => c.id === cat.parent_category_id)?.name ??
                          'subcategory'}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => toggleActive(cat)}>
                      <Badge
                        variant={cat.is_active ? 'default' : 'secondary'}
                        className="cursor-pointer text-xs"
                      >
                        {cat.is_active ? 'Active' : 'Hidden'}
                      </Badge>
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(cat)} title="Edit">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteTarget(cat)}
                        title="Delete"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Add / Edit Dialog ─────────────────────────────────────────────── */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? 'Edit Dish Category' : 'Add Dish Category'}
            </DialogTitle>
            <DialogDescription>
              Categories help organize dishes across all restaurants for the mobile app.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Name */}
            <div>
              <Label htmlFor="cat-name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="cat-name"
                value={formData.name}
                onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Pizza"
                className="mt-1"
              />
            </div>

            {/* Type: food / drink */}
            <div className="flex items-center gap-3">
              <Checkbox
                id="cat-is-drink"
                checked={formData.is_drink}
                onCheckedChange={val => setFormData(prev => ({ ...prev, is_drink: val === true }))}
              />
              <Label htmlFor="cat-is-drink" className="cursor-pointer font-normal">
                <GlassWater className="h-3.5 w-3.5 inline-block mr-0.5" />Drink category
              </Label>
            </div>

            {/* Parent category */}
            {parentOptions.length > 0 && (
              <div>
                <Label htmlFor="cat-parent">Parent Category (optional)</Label>
                <Select
                  value={formData.parent_category_id ?? 'none'}
                  onValueChange={val =>
                    setFormData(prev => ({
                      ...prev,
                      parent_category_id: val === 'none' ? null : val,
                    }))
                  }
                >
                  <SelectTrigger id="cat-parent" className="mt-1">
                    <SelectValue placeholder="— Top-level category —" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Top-level category —</SelectItem>
                    {parentOptions.map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Active toggle */}
            <div className="flex items-center gap-3">
              <Checkbox
                id="cat-active"
                checked={formData.is_active}
                onCheckedChange={val => setFormData(prev => ({ ...prev, is_active: val === true }))}
              />
              <Label htmlFor="cat-active" className="cursor-pointer font-normal">
                Active (visible to restaurant owners and the mobile app)
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : editingCategory ? 'Save Changes' : 'Create Category'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation ───────────────────────────────────────────── */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open: boolean) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &quot;{deleteTarget?.name}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the category. Existing dishes that reference it will have
              their category set to null — they won&apos;t be deleted. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive hover:bg-destructive/90 text-white"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
