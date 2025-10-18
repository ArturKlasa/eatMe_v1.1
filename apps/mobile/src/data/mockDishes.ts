/**
 * Mock dish data - simplified for development
 */

export interface Dish {
  id: string;
  name: string;
  restaurantId: string;
  restaurantName: string;
  cuisine: string;
  price: number;
  priceRange: '$' | '$$' | '$$$' | '$$$$';
  coordinates: [number, number]; // [longitude, latitude]
  description: string;
  isAvailable: boolean;
  rating: number;
}

export const mockDishes: Dish[] = [
  // La Casa de Toño
  {
    id: 'dish_1',
    name: 'Tacos al Pastor',
    restaurantId: '1',
    restaurantName: 'La Casa de Toño',
    cuisine: 'Mexican',
    price: 12.99,
    priceRange: '$$',
    coordinates: [-122.081, 37.424],
    description: 'Marinated pork with pineapple on corn tortillas',
    isAvailable: true,
    rating: 4.6,
  },
  {
    id: 'dish_2',
    name: 'Vegetarian Burrito Bowl',
    restaurantId: '1',
    restaurantName: 'La Casa de Toño',
    cuisine: 'Mexican',
    price: 10.99,
    priceRange: '$$',
    coordinates: [-122.081, 37.424],
    description: 'Black beans, rice, peppers, and fresh salsa',
    isAvailable: true,
    rating: 4.3,
  },

  // Pujol
  {
    id: 'dish_3',
    name: 'Mole Madre, Mole Nuevo',
    restaurantId: '2',
    restaurantName: 'Pujol',
    cuisine: 'Contemporary Mexican',
    price: 85.0,
    priceRange: '$$$$',
    coordinates: [-122.087, 37.42],
    description: 'Signature dish with aged mole and fresh mole',
    isAvailable: true,
    rating: 4.9,
  },
  {
    id: 'dish_4',
    name: 'Octopus with Escabeche',
    restaurantId: '2',
    restaurantName: 'Pujol',
    cuisine: 'Contemporary Mexican',
    price: 65.0,
    priceRange: '$$$$',
    coordinates: [-122.087, 37.42],
    description: 'Tender octopus with pickled vegetables',
    isAvailable: true,
    rating: 4.7,
  },

  // Contramar
  {
    id: 'dish_5',
    name: 'Grilled Red Snapper',
    restaurantId: '3',
    restaurantName: 'Contramar',
    cuisine: 'Seafood',
    price: 32.0,
    priceRange: '$$$',
    coordinates: [-122.079, 37.42],
    description: 'Fresh red snapper with green and red salsas',
    isAvailable: false,
    rating: 4.8,
  },
  {
    id: 'dish_6',
    name: 'Seafood Tostada',
    restaurantId: '3',
    restaurantName: 'Contramar',
    cuisine: 'Seafood',
    price: 18.0,
    priceRange: '$$$',
    coordinates: [-122.079, 37.42],
    description: 'Mixed seafood on crispy tortilla with avocado',
    isAvailable: true,
    rating: 4.5,
  },

  // Rosetta
  {
    id: 'dish_7',
    name: 'Handmade Pasta with Truffle',
    restaurantId: '4',
    restaurantName: 'Rosetta',
    cuisine: 'Italian',
    price: 28.0,
    priceRange: '$$$',
    coordinates: [-122.083, 37.418],
    description: 'Fresh pasta with seasonal truffle and parmesan',
    isAvailable: true,
    rating: 4.6,
  },
  {
    id: 'dish_8',
    name: 'Osso Buco Milanese',
    restaurantId: '4',
    restaurantName: 'Rosetta',
    cuisine: 'Italian',
    price: 42.0,
    priceRange: '$$$',
    coordinates: [-122.083, 37.418],
    description: 'Braised veal shanks with saffron risotto',
    isAvailable: true,
    rating: 4.8,
  },

  // Quintonil
  {
    id: 'dish_9',
    name: 'Corn with Chicatana Ant',
    restaurantId: '5',
    restaurantName: 'Quintonil',
    cuisine: 'Contemporary Mexican',
    price: 38.0,
    priceRange: '$$$$',
    coordinates: [-122.084, 37.422],
    description: 'Heritage corn with traditional chicatana ant',
    isAvailable: true,
    rating: 4.4,
  },
  {
    id: 'dish_10',
    name: 'Duck with Mole Poblano',
    restaurantId: '5',
    restaurantName: 'Quintonil',
    cuisine: 'Contemporary Mexican',
    price: 55.0,
    priceRange: '$$$$',
    coordinates: [-122.084, 37.422],
    description: 'Slow-cooked duck breast with mole poblano',
    isAvailable: true,
    rating: 4.9,
  },
];

// Helper functions
export const getDishById = (id: string) => mockDishes.find(dish => dish.id === id);
export const getDishesByRestaurant = (restaurantId: string) =>
  mockDishes.filter(dish => dish.restaurantId === restaurantId);
export const getAvailableDishes = () => mockDishes.filter(dish => dish.isAvailable);
