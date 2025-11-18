import { RestaurantData, Dish } from '@/types/restaurant';

/**
 * Export restaurant data as JSON file
 * Matches the Supabase database schema
 */
export const exportAsJSON = (data: RestaurantData): void => {
  try {
    // Format data to match database schema
    const exportData = {
      restaurant: {
        name: data.restaurant.name,
        description: data.restaurant.description,
        address: data.restaurant.address,
        location: {
          type: 'Point',
          coordinates: [data.restaurant.location.lng, data.restaurant.location.lat],
        },
        phone: data.restaurant.phone,
        website: data.restaurant.website || null,
        price_range: data.restaurant.price_range,
        cuisines: data.restaurant.cuisines,
        average_prep_time_minutes: data.restaurant.average_prep_time_minutes,
        accepts_reservations: data.restaurant.accepts_reservations,
        delivery_available: data.restaurant.delivery_available,
        takeout_available: data.restaurant.takeout_available,
        operating_hours: data.restaurant.operating_hours,
      },
      dishes: data.dishes.map(dish => ({
        name: dish.name,
        description: dish.description,
        price: dish.price,
        dietary_tags: dish.dietary_tags,
        allergens: dish.allergens,
        ingredients: dish.ingredients,
        photo_url: dish.photo_url || null,
      })),
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json',
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;

    const filename = `restaurant-${data.restaurant.name
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')}-${Date.now()}.json`;

    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Failed to export JSON:', error);
    throw new Error('Failed to export data as JSON');
  }
};

/**
 * Export menu items as CSV file
 */
export const exportAsCSV = (dishes: Dish[], restaurantName: string): void => {
  try {
    const headers = [
      'Name',
      'Description',
      'Price',
      'Dietary Tags',
      'Allergens',
      'Ingredients',
      'Photo URL',
    ];

    const rows = dishes.map(dish => [
      escapeCSV(dish.name),
      escapeCSV(dish.description),
      dish.price.toFixed(2),
      escapeCSV(dish.dietary_tags.join('; ')),
      escapeCSV(dish.allergens.join('; ')),
      escapeCSV(dish.ingredients.join('; ')),
      dish.photo_url || '',
    ]);

    const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;

    const filename = `menu-${restaurantName
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')}-${Date.now()}.csv`;

    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Failed to export CSV:', error);
    throw new Error('Failed to export data as CSV');
  }
};

/**
 * Escape CSV field value
 */
function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Generate CSV template for bulk menu import
 */
export const downloadCSVTemplate = (): void => {
  const headers = [
    'Name',
    'Description',
    'Price',
    'Dietary Tags (semicolon separated)',
    'Allergens (semicolon separated)',
    'Ingredients (semicolon separated)',
    'Photo URL (optional)',
  ];

  const exampleRow = [
    'Margherita Pizza',
    'Classic pizza with fresh mozzarella and basil',
    '16.99',
    'vegetarian',
    'dairy; gluten',
    'tomato; mozzarella; basil; olive oil; flour',
    '',
  ];

  const csvContent = [headers.join(','), exampleRow.join(',')].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'menu-import-template.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
