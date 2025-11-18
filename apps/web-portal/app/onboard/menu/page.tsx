'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DishCard } from '@/components/forms/DishCard';
import { DishFormDialog } from '@/components/forms/DishFormDialog';
import { toast } from 'sonner';
import { Dish } from '@/types/restaurant';
import { menuSchema, type MenuFormData } from '@/lib/validation';
import { loadRestaurantData, saveRestaurantData } from '@/lib/storage';
import { downloadCSVTemplate } from '@/lib/export';
import { PlusCircle, Upload, Download, ArrowLeft, ArrowRight } from 'lucide-react';

export default function MenuPage() {
  const router = useRouter();
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [editingDish, setEditingDish] = useState<Dish | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const form = useForm<MenuFormData>({
    resolver: zodResolver(menuSchema),
    defaultValues: {
      dishes: [],
    },
  });

  // Load saved data on mount
  useEffect(() => {
    const savedData = loadRestaurantData();
    if (savedData?.dishes && savedData.dishes.length > 0) {
      setDishes(savedData.dishes);
      form.setValue('dishes', savedData.dishes);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-save dishes
  useEffect(() => {
    if (dishes.length > 0) {
      const savedData = loadRestaurantData();
      if (savedData) {
        saveRestaurantData({
          ...savedData,
          dishes,
          currentStep: 3,
        });
      }
    }
  }, [dishes]);

  const handleAddDish = (dish: Dish) => {
    const newDish = {
      ...dish,
      id: dish.id || crypto.randomUUID(),
    };
    setDishes([...dishes, newDish]);
    form.setValue('dishes', [...dishes, newDish]);
    toast.success('Dish added successfully!');
    setIsDialogOpen(false);
  };

  const handleEditDish = (dish: Dish) => {
    setEditingDish(dish);
    setIsDialogOpen(true);
  };

  const handleUpdateDish = (updatedDish: Dish) => {
    const updatedDishes = dishes.map(d => (d.id === updatedDish.id ? updatedDish : d));
    setDishes(updatedDishes);
    form.setValue('dishes', updatedDishes);
    toast.success('Dish updated successfully!');
    setEditingDish(null);
    setIsDialogOpen(false);
  };

  const handleDeleteDish = (dishId: string) => {
    const updatedDishes = dishes.filter(d => d.id !== dishId);
    setDishes(updatedDishes);
    form.setValue('dishes', updatedDishes);
    toast.success('Dish deleted');
  };

  const handleDuplicateDish = (dish: Dish) => {
    const duplicatedDish = {
      ...dish,
      id: crypto.randomUUID(),
      name: `${dish.name} (Copy)`,
    };
    setDishes([...dishes, duplicatedDish]);
    form.setValue('dishes', [...dishes, duplicatedDish]);
    toast.success('Dish duplicated!');
  };

  const handleNext = () => {
    const result = menuSchema.safeParse({ dishes });

    if (!result.success) {
      toast.error('Please add at least one dish before continuing');
      return;
    }

    router.push('/onboard/review');
  };

  const handleBack = () => {
    router.push('/onboard/operations');
  };

  const handleOpenDialog = () => {
    setEditingDish(null);
    setIsDialogOpen(true);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Menu Entry</h1>
          <p className="text-gray-600">
            Add your menu items. You can add them one by one or use our CSV template for bulk
            import.
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-3 mb-6">
          <Button onClick={handleOpenDialog} size="lg">
            <PlusCircle className="mr-2 h-5 w-5" />
            Add Dish
          </Button>

          <Button variant="outline" size="lg" onClick={downloadCSVTemplate}>
            <Download className="mr-2 h-5 w-5" />
            Download CSV Template
          </Button>

          <Button variant="outline" size="lg" disabled>
            <Upload className="mr-2 h-5 w-5" />
            Import from CSV
            <span className="ml-2 text-xs bg-gray-200 px-2 py-1 rounded">Coming Soon</span>
          </Button>
        </div>

        {/* Dishes List */}
        {dishes.length === 0 ? (
          <Card className="p-12 text-center">
            <div className="flex flex-col items-center gap-4">
              <div className="bg-gray-100 rounded-full p-6">
                <PlusCircle className="h-12 w-12 text-gray-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-2">No dishes yet</h3>
                <p className="text-gray-600 mb-4">
                  Start adding your menu items to showcase what you offer
                </p>
                <Button onClick={handleOpenDialog}>
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Add Your First Dish
                </Button>
              </div>
            </div>
          </Card>
        ) : (
          <div className="space-y-4 mb-8">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600">
                {dishes.length} {dishes.length === 1 ? 'dish' : 'dishes'} added
              </p>
            </div>
            {dishes.map(dish => (
              <DishCard
                key={dish.id}
                dish={dish}
                onEdit={handleEditDish}
                onDelete={handleDeleteDish}
                onDuplicate={handleDuplicateDish}
              />
            ))}
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between pt-6 border-t">
          <Button variant="outline" onClick={handleBack}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Operations
          </Button>
          <Button onClick={handleNext} disabled={dishes.length === 0}>
            Continue to Review
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>

        {/* Dialog for Add/Edit Dish */}
        <DishFormDialog
          isOpen={isDialogOpen}
          onClose={() => {
            setIsDialogOpen(false);
            setEditingDish(null);
          }}
          onSubmit={editingDish ? handleUpdateDish : handleAddDish}
          dish={editingDish}
        />
      </div>
    </div>
  );
}
