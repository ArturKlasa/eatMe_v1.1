export function ingredientEntryEnabled(): boolean {
  return process.env.NEXT_PUBLIC_INGREDIENT_ENTRY_ENABLED === 'true';
}
