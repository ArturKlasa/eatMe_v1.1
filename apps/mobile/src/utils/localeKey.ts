/**
 * Converts a display name like "Comfort Food" or "Fish & Chips" to the
 * camelCase locale key used in the i18n JSON files ("comfortFood", "fishAndChips").
 *
 * NOT title-case — it strips accents/spaces and lowercases the first word so the
 * result is a stable key, e.g. t(`filters.cuisines.${toLocaleKey(name)}`).
 */
export const toLocaleKey = (str: string): string => {
  const normalized = str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip accents (Cafe)
    .replace(/&/g, 'And'); // Fish & Chips → Fish And Chips
  const words = normalized.trim().split(/\s+/);
  return (
    words[0].toLowerCase() +
    words
      .slice(1)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join('')
  );
};
