/**
 * Mock restaurant data for development and testing
 * This will be replaced with real API data in later phases
 */

export interface Restaurant {
  id: string;
  name: string;
  cuisine: string;
  rating: number;
  priceRange: '$' | '$$' | '$$$' | '$$$$';
  coordinates: [number, number]; // [longitude, latitude] - GeoJSON format
  address: string;
  phone?: string;
  description: string;
  imageUrl?: string;
  isOpen: boolean;
  openingHours: {
    open: string;
    close: string;
  };
}

export const mockRestaurants: Restaurant[] = [
  {
    id: '1',
    name: 'La Casa de Toño',
    cuisine: 'Mexican',
    rating: 4.5,
    priceRange: '$$',
    coordinates: [-99.184, 19.435], // North of Anzures
    address: 'Av. Ejército Nacional 843, Anzures, 11590 Ciudad de México, CDMX',
    phone: '+52 55 5203 4567',
    description: 'Authentic Mexican pozole and traditional cuisine',
    imageUrl: 'https://via.placeholder.com/300x200',
    isOpen: true,
    openingHours: {
      open: '08:00',
      close: '22:00',
    },
  },
  {
    id: '2',
    name: 'Pujol',
    cuisine: 'Contemporary Mexican',
    rating: 4.8,
    priceRange: '$$$$',
    coordinates: [-99.188, 19.431], // West of Anzures
    address: 'Tennyson 133, Polanco, 11560 Ciudad de México, CDMX',
    phone: '+52 55 5545 3507',
    description: 'World-renowned contemporary Mexican restaurant by chef Enrique Olvera',
    imageUrl: 'https://via.placeholder.com/300x200',
    isOpen: true,
    openingHours: {
      open: '13:00',
      close: '23:00',
    },
  },
  {
    id: '3',
    name: 'Contramar',
    cuisine: 'Seafood',
    rating: 4.6,
    priceRange: '$$$',
    coordinates: [-99.182, 19.433], // East of Anzures
    address: 'Durango 200, Roma Nte., 06700 Ciudad de México, CDMX',
    phone: '+52 55 5514 9217',
    description: 'Fresh seafood and vibrant atmosphere, famous for tuna tostadas',
    imageUrl: 'https://via.placeholder.com/300x200',
    isOpen: false,
    openingHours: {
      open: '13:00',
      close: '18:30',
    },
  },
  {
    id: '4',
    name: 'Rosetta',
    cuisine: 'Italian',
    rating: 4.7,
    priceRange: '$$$',
    coordinates: [-99.185, 19.43], // South of Anzures
    address: 'Colima 166, Roma Nte., 06700 Ciudad de México, CDMX',
    phone: '+52 55 5533 7804',
    description: 'Elegant Italian dining in a beautiful colonial mansion',
    imageUrl: 'https://via.placeholder.com/300x200',
    isOpen: true,
    openingHours: {
      open: '08:00',
      close: '24:00',
    },
  },
  {
    id: '5',
    name: 'Quintonil',
    cuisine: 'Contemporary Mexican',
    rating: 4.9,
    priceRange: '$$$$',
    coordinates: [-99.185, 19.4326], // Center of Anzures
    address: 'Av. Isaac Newton 55, Polanco, 11560 Ciudad de México, CDMX',
    phone: '+52 55 5280 2680',
    description: 'Innovative Mexican cuisine with seasonal local ingredients',
    imageUrl: 'https://via.placeholder.com/300x200',
    isOpen: true,
    openingHours: {
      open: '13:30',
      close: '23:00',
    },
  },
];

// Helper functions for working with restaurant data
export const getRestaurantById = (id: string): Restaurant | undefined => {
  return mockRestaurants.find(restaurant => restaurant.id === id);
};

export const getOpenRestaurants = (): Restaurant[] => {
  return mockRestaurants.filter(restaurant => restaurant.isOpen);
};

export const getRestaurantsByCuisine = (cuisine: string): Restaurant[] => {
  return mockRestaurants.filter(
    restaurant => restaurant.cuisine.toLowerCase() === cuisine.toLowerCase()
  );
};

export const getRestaurantsByPriceRange = (priceRange: Restaurant['priceRange']): Restaurant[] => {
  return mockRestaurants.filter(restaurant => restaurant.priceRange === priceRange);
};
