'use client';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dish } from '@/types/restaurant';
import { Edit, Trash2, Copy, Layers, AlertTriangle } from 'lucide-react';
import { SPICE_LEVELS, DISH_KINDS } from '@/lib/constants';

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

              <span className="text-lg font-bold text-success">
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
            {dish.description && <p className="text-sm text-muted-foreground">{dish.description}</p>}
          </div>
          <div className="flex gap-2 ml-4">
            <Button variant="ghost" size="icon" onClick={() => onEdit(dish)} title="Edit dish" aria-label="Edit dish">
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onDuplicate(dish)}
              title="Duplicate dish"
              aria-label="Duplicate dish"
            >
              <Copy className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => dish.id && onDelete(dish.id)}
              title="Delete dish"
              aria-label="Delete dish"
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {/* Ingredients — shown in wizard mode only (selectedIngredients from autocomplete) */}
          {dish.selectedIngredients && dish.selectedIngredients.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Ingredients:</p>
              <div className="flex flex-wrap gap-1">
                {dish.selectedIngredients.map((ing, idx) => (
                  <Badge key={ing.id ?? idx} variant="secondary" className="text-xs">
                    {ing.display_name}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Tags and Allergens */}
          <div className="flex flex-wrap gap-2">
            {/* Spice Level */}
            {dish.spice_level && dish.spice_level !== 'none' && (
              <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">
                {SPICE_LEVELS.find(l => l.value === dish.spice_level)?.icon}
              </Badge>
            )}

            {/* Dietary Tags */}
            {dish.dietary_tags.map(tag => (
              <Badge
                key={tag}
                variant="secondary"
                className="bg-success/10 text-success capitalize"
              >
                {tag}
              </Badge>
            ))}

            {/* Allergens */}
            {dish.allergens.map(allergen => (
              <Badge
                key={allergen}
                variant="secondary"
                className="bg-brand-primary/10 text-brand-primary capitalize"
              >
                <AlertTriangle className="h-3 w-3 inline-block mr-0.5" />{allergen}
              </Badge>
            ))}
          </div>

          {/* Photo indicator */}
          {dish.photo_url && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="text-success">✓</span> Photo included
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
