'use client';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dish } from '@/types/restaurant';
import { Edit, Trash2, Copy, Layers } from 'lucide-react';
import { SPICE_LEVELS, DISH_KINDS, DISPLAY_PRICE_PREFIXES } from '@/lib/constants';

interface DishCardProps {
  dish: Dish;
  onEdit: (dish: Dish) => void;
  onDelete: (dishId: string) => void;
  onDuplicate: (dish: Dish) => void;
}

/** Format price with the correct prefix label. */
function formatPrice(price: number, prefix?: string): string {
  const formatted = `$${price.toFixed(2)}`;
  switch (prefix) {
    case 'from':
      return `from ${formatted}`;
    case 'per_person':
      return `${formatted} / person`;
    case 'market_price':
      return 'Market price';
    case 'ask_server':
      return 'Ask server';
    default:
      return formatted;
  }
}

export function DishCard({ dish, onEdit, onDelete, onDuplicate }: DishCardProps) {
  const dishKindMeta = DISH_KINDS.find(k => k.value === (dish.dish_kind ?? 'standard'));
  const isComposable = dish.dish_kind === 'template' || dish.dish_kind === 'experience';
  const optionGroupCount = dish.option_groups?.length ?? 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h3 className="text-lg font-semibold">{dish.name}</h3>

              {/* Dish kind badge — only for non-standard */}
              {isComposable && dishKindMeta && (
                <Badge
                  variant="outline"
                  className="text-xs border-purple-300 text-purple-700 bg-purple-50"
                >
                  {dishKindMeta.icon} {dishKindMeta.label}
                </Badge>
              )}

              <span className="text-lg font-bold text-green-600">
                {formatPrice(dish.price, dish.display_price_prefix)}
              </span>

              {dish.calories && (
                <Badge variant="outline" className="text-xs">
                  {dish.calories} cal
                </Badge>
              )}

              {/* Option group count */}
              {isComposable && optionGroupCount > 0 && (
                <Badge variant="secondary" className="text-xs flex items-center gap-1">
                  <Layers className="h-3 w-3" />
                  {optionGroupCount} {optionGroupCount === 1 ? 'group' : 'groups'}
                </Badge>
              )}
            </div>
            {dish.description && <p className="text-sm text-gray-600">{dish.description}</p>}
          </div>
          <div className="flex gap-2 ml-4">
            <Button variant="ghost" size="icon" onClick={() => onEdit(dish)} title="Edit dish">
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onDuplicate(dish)}
              title="Duplicate dish"
            >
              <Copy className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => dish.id && onDelete(dish.id)}
              title="Delete dish"
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {/* Ingredients — shown in wizard mode only (selectedIngredients from autocomplete) */}
          {(dish as any).selectedIngredients?.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">Ingredients:</p>
              <div className="flex flex-wrap gap-1">
                {(dish as any).selectedIngredients.map((ing: any, idx: number) => (
                  <Badge key={idx} variant="secondary" className="text-xs">
                    {ing.name}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Tags and Allergens */}
          <div className="flex flex-wrap gap-2">
            {/* Spice Level */}
            {dish.spice_level && dish.spice_level !== 'none' && (
              <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                {SPICE_LEVELS.find(l => l.value === dish.spice_level)?.icon}
              </Badge>
            )}

            {/* Dietary Tags */}
            {dish.dietary_tags.map(tag => (
              <Badge
                key={tag}
                variant="secondary"
                className="bg-green-100 text-green-800 capitalize"
              >
                {tag}
              </Badge>
            ))}

            {/* Allergens */}
            {dish.allergens.map(allergen => (
              <Badge
                key={allergen}
                variant="secondary"
                className="bg-orange-100 text-orange-800 capitalize"
              >
                ⚠️ {allergen}
              </Badge>
            ))}
          </div>

          {/* Photo indicator */}
          {dish.photo_url && (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <span className="text-green-600">✓</span> Photo included
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
