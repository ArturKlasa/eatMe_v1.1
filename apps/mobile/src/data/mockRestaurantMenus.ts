/**
 * Mock restaurant menu data with full menu structure
 * This will be replaced with real API data in later phases
 */

export interface MenuItem {
  id: string;
  name: string;
  price: number;
  description: string;
  ingredients: string[];
  isVegetarian: boolean;
  isVegan: boolean;
  calories?: number;
  imageUrl?: string;
}

export interface MenuCategory {
  id: string;
  name: string;
  items: MenuItem[];
}

export interface RestaurantMenu {
  restaurantId: string;
  categories: MenuCategory[];
}

export interface DetailedRestaurant {
  id: string;
  name: string;
  cuisine: string;
  rating: number;
  reviewCount: number;
  priceRange: '$' | '$$' | '$$$' | '$$$$';
  coordinates: [number, number];
  address: string;
  phone: string;
  description: string;
  imageUrl: string;
  isOpen: boolean;
  openingHours: {
    monday: { open: string; close: string };
    tuesday: { open: string; close: string };
    wednesday: { open: string; close: string };
    thursday: { open: string; close: string };
    friday: { open: string; close: string };
    saturday: { open: string; close: string };
    sunday: { open: string; close: string };
  };
  paymentMethods: {
    acceptsCards: boolean;
    acceptsCash: boolean;
    acceptsDigitalPayments: boolean;
  };
  menu: MenuCategory[];
}

export const mockRestaurantMenus: { [key: string]: DetailedRestaurant } = {
  '1': {
    id: '1',
    name: 'La Casa de Toño',
    cuisine: 'Mexican',
    rating: 4.5,
    reviewCount: 342,
    priceRange: '$$',
    coordinates: [-122.081, 37.424],
    address: '123 Main St, Palo Alto, CA',
    phone: '+1 650 123 4567',
    description: 'Authentic Mexican cuisine in the heart of Silicon Valley',
    imageUrl: 'https://via.placeholder.com/400x200',
    isOpen: true,
    openingHours: {
      monday: { open: '08:00', close: '22:00' },
      tuesday: { open: '08:00', close: '22:00' },
      wednesday: { open: '08:00', close: '22:00' },
      thursday: { open: '08:00', close: '22:00' },
      friday: { open: '08:00', close: '23:00' },
      saturday: { open: '09:00', close: '23:00' },
      sunday: { open: '09:00', close: '21:00' },
    },
    paymentMethods: {
      acceptsCards: true,
      acceptsCash: true,
      acceptsDigitalPayments: true,
    },
    menu: [
      {
        id: 'appetizers',
        name: 'Appetizers',
        items: [
          {
            id: 'app_1',
            name: 'Guacamole Tradicional',
            price: 8.99,
            description: 'Fresh avocado, lime, cilantro, and jalapeño',
            ingredients: ['avocado', 'lime', 'cilantro', 'jalapeño', 'onion'],
            isVegetarian: true,
            isVegan: true,
            calories: 180,
          },
          {
            id: 'app_2',
            name: 'Queso Fundido',
            price: 10.99,
            description: 'Melted Oaxaca cheese with chorizo',
            ingredients: ['oaxaca cheese', 'chorizo', 'tortillas'],
            isVegetarian: false,
            isVegan: false,
            calories: 320,
          },
          {
            id: 'app_3',
            name: 'Elote Asado',
            price: 6.99,
            description: 'Grilled corn with mayo, cheese, and chili powder',
            ingredients: ['corn', 'mayonnaise', 'cotija cheese', 'chili powder', 'lime'],
            isVegetarian: true,
            isVegan: false,
            calories: 250,
          },
        ],
      },
      {
        id: 'salads',
        name: 'Salads',
        items: [
          {
            id: 'sal_1',
            name: 'Ensalada de Nopales',
            price: 9.99,
            description: 'Fresh cactus salad with tomatoes and onions',
            ingredients: ['nopales', 'tomatoes', 'onions', 'cilantro', 'lime'],
            isVegetarian: true,
            isVegan: true,
            calories: 120,
          },
          {
            id: 'sal_2',
            name: 'Caesar Mexicana',
            price: 11.99,
            description: 'Romaine lettuce with chipotle caesar dressing',
            ingredients: ['romaine', 'parmesan', 'tortilla strips', 'chipotle dressing'],
            isVegetarian: true,
            isVegan: false,
            calories: 280,
          },
        ],
      },
      {
        id: 'entrees',
        name: 'Entrées',
        items: [
          {
            id: 'ent_1',
            name: 'Tacos al Pastor',
            price: 12.99,
            description: 'Marinated pork with pineapple on corn tortillas',
            ingredients: ['pork', 'pineapple', 'corn tortillas', 'onion', 'cilantro'],
            isVegetarian: false,
            isVegan: false,
            calories: 450,
          },
          {
            id: 'ent_2',
            name: 'Enchiladas Verdes',
            price: 14.99,
            description: 'Chicken enchiladas with green tomatillo sauce',
            ingredients: ['chicken', 'tortillas', 'tomatillo sauce', 'cheese', 'cream'],
            isVegetarian: false,
            isVegan: false,
            calories: 520,
          },
          {
            id: 'ent_3',
            name: 'Vegetarian Burrito Bowl',
            price: 10.99,
            description: 'Black beans, rice, peppers, and fresh salsa',
            ingredients: ['black beans', 'rice', 'bell peppers', 'salsa', 'guacamole'],
            isVegetarian: true,
            isVegan: true,
            calories: 420,
          },
          {
            id: 'ent_4',
            name: 'Carne Asada',
            price: 18.99,
            description: 'Grilled marinated steak with chimichurri',
            ingredients: ['beef', 'chimichurri', 'rice', 'beans', 'tortillas'],
            isVegetarian: false,
            isVegan: false,
            calories: 680,
          },
        ],
      },
      {
        id: 'drinks',
        name: 'Drinks',
        items: [
          {
            id: 'drk_1',
            name: 'Agua de Jamaica',
            price: 3.99,
            description: 'Refreshing hibiscus tea',
            ingredients: ['hibiscus', 'sugar', 'water'],
            isVegetarian: true,
            isVegan: true,
            calories: 80,
          },
          {
            id: 'drk_2',
            name: 'Horchata',
            price: 4.99,
            description: 'Sweet rice milk with cinnamon',
            ingredients: ['rice', 'milk', 'cinnamon', 'vanilla'],
            isVegetarian: true,
            isVegan: false,
            calories: 150,
          },
          {
            id: 'drk_3',
            name: 'Margarita',
            price: 8.99,
            description: 'Classic lime margarita',
            ingredients: ['tequila', 'lime juice', 'triple sec', 'salt'],
            isVegetarian: true,
            isVegan: true,
            calories: 220,
          },
        ],
      },
      {
        id: 'desserts',
        name: 'Desserts',
        items: [
          {
            id: 'des_1',
            name: 'Churros',
            price: 6.99,
            description: 'Crispy fried dough with chocolate sauce',
            ingredients: ['flour', 'sugar', 'cinnamon', 'chocolate'],
            isVegetarian: true,
            isVegan: false,
            calories: 340,
          },
          {
            id: 'des_2',
            name: 'Flan',
            price: 5.99,
            description: 'Traditional caramel custard',
            ingredients: ['eggs', 'milk', 'sugar', 'vanilla'],
            isVegetarian: true,
            isVegan: false,
            calories: 280,
          },
        ],
      },
    ],
  },
  '2': {
    id: '2',
    name: 'Pujol',
    cuisine: 'Contemporary Mexican',
    rating: 4.8,
    reviewCount: 892,
    priceRange: '$$$$',
    coordinates: [-122.087, 37.42],
    address: '456 University Ave, Palo Alto, CA',
    phone: '+1 650 555 3507',
    description: 'World-renowned contemporary Mexican restaurant',
    imageUrl: 'https://via.placeholder.com/400x200',
    isOpen: true,
    openingHours: {
      monday: { open: '13:00', close: '23:00' },
      tuesday: { open: '13:00', close: '23:00' },
      wednesday: { open: '13:00', close: '23:00' },
      thursday: { open: '13:00', close: '23:00' },
      friday: { open: '13:00', close: '24:00' },
      saturday: { open: '13:00', close: '24:00' },
      sunday: { open: '13:00', close: '22:00' },
    },
    paymentMethods: {
      acceptsCards: true,
      acceptsCash: false,
      acceptsDigitalPayments: true,
    },
    menu: [
      {
        id: 'appetizers',
        name: 'Appetizers',
        items: [
          {
            id: 'app_1',
            name: 'Sea Urchin Tostada',
            price: 24.0,
            description: 'Fresh sea urchin on crispy tostada with citrus',
            ingredients: ['sea urchin', 'tostada', 'lime', 'chili oil'],
            isVegetarian: false,
            isVegan: false,
            calories: 180,
          },
          {
            id: 'app_2',
            name: 'Baby Corn with Coffee',
            price: 18.0,
            description: 'Heirloom baby corn with coffee powder',
            ingredients: ['baby corn', 'coffee', 'herbs', 'aioli'],
            isVegetarian: true,
            isVegan: false,
            calories: 140,
          },
        ],
      },
      {
        id: 'entrees',
        name: 'Entrées',
        items: [
          {
            id: 'ent_1',
            name: 'Mole Madre, Mole Nuevo',
            price: 45.0,
            description: 'Legendary mole aged 1,000+ days with new mole',
            ingredients: ['mole negro', 'chicken', 'sesame', 'chocolate'],
            isVegetarian: false,
            isVegan: false,
            calories: 620,
          },
          {
            id: 'ent_2',
            name: 'Duck Carnitas',
            price: 42.0,
            description: 'Confit duck with traditional carnitas preparation',
            ingredients: ['duck', 'orange', 'herbs', 'tortillas'],
            isVegetarian: false,
            isVegan: false,
            calories: 580,
          },
          {
            id: 'ent_3',
            name: 'Heirloom Vegetable Tasting',
            price: 38.0,
            description: 'Seasonal vegetables with indigenous techniques',
            ingredients: ['seasonal vegetables', 'herbs', 'seeds', 'mole verde'],
            isVegetarian: true,
            isVegan: true,
            calories: 380,
          },
        ],
      },
      {
        id: 'drinks',
        name: 'Drinks',
        items: [
          {
            id: 'drk_1',
            name: 'Mezcal Selection',
            price: 15.0,
            description: 'Curated mezcal from Oaxaca',
            ingredients: ['mezcal'],
            isVegetarian: true,
            isVegan: true,
            calories: 120,
          },
        ],
      },
      {
        id: 'desserts',
        name: 'Desserts',
        items: [
          {
            id: 'des_1',
            name: 'Corn Textures',
            price: 16.0,
            description: 'Multiple preparations of heirloom corn',
            ingredients: ['heirloom corn', 'cream', 'honey', 'herbs'],
            isVegetarian: true,
            isVegan: false,
            calories: 320,
          },
        ],
      },
    ],
  },
  '3': {
    id: '3',
    name: 'Contramar',
    cuisine: 'Seafood',
    rating: 4.6,
    reviewCount: 567,
    priceRange: '$$$',
    coordinates: [-122.079, 37.42],
    address: '789 Forest Ave, Palo Alto, CA',
    phone: '+1 650 514 9217',
    description: 'Fresh seafood and vibrant atmosphere',
    imageUrl: 'https://via.placeholder.com/400x200',
    isOpen: false,
    openingHours: {
      monday: { open: 'Closed', close: 'Closed' },
      tuesday: { open: '13:00', close: '18:30' },
      wednesday: { open: '13:00', close: '18:30' },
      thursday: { open: '13:00', close: '18:30' },
      friday: { open: '13:00', close: '19:00' },
      saturday: { open: '13:00', close: '19:00' },
      sunday: { open: '13:00', close: '18:00' },
    },
    paymentMethods: {
      acceptsCards: true,
      acceptsCash: true,
      acceptsDigitalPayments: false,
    },
    menu: [
      {
        id: 'appetizers',
        name: 'Appetizers',
        items: [
          {
            id: 'app_1',
            name: 'Tuna Tostadas',
            price: 16.99,
            description: 'Fresh tuna on crispy tostadas',
            ingredients: ['tuna', 'avocado', 'chipotle mayo', 'tostada'],
            isVegetarian: false,
            isVegan: false,
            calories: 220,
          },
          {
            id: 'app_2',
            name: 'Aguachile',
            price: 14.99,
            description: 'Raw shrimp in lime and chili water',
            ingredients: ['shrimp', 'lime', 'serrano chili', 'cucumber'],
            isVegetarian: false,
            isVegan: false,
            calories: 180,
          },
        ],
      },
      {
        id: 'entrees',
        name: 'Entrées',
        items: [
          {
            id: 'ent_1',
            name: 'Pescado a la Talla',
            price: 28.99,
            description: 'Grilled butterflied fish with two sauces',
            ingredients: ['whole fish', 'red sauce', 'green sauce', 'rice'],
            isVegetarian: false,
            isVegan: false,
            calories: 520,
          },
          {
            id: 'ent_2',
            name: 'Camarones al Ajillo',
            price: 24.99,
            description: 'Garlic shrimp with guajillo chili',
            ingredients: ['shrimp', 'garlic', 'guajillo', 'butter'],
            isVegetarian: false,
            isVegan: false,
            calories: 440,
          },
        ],
      },
      {
        id: 'drinks',
        name: 'Drinks',
        items: [
          {
            id: 'drk_1',
            name: 'Michelada',
            price: 7.99,
            description: 'Beer with lime and spices',
            ingredients: ['beer', 'lime', 'hot sauce', 'salt'],
            isVegetarian: true,
            isVegan: true,
            calories: 180,
          },
        ],
      },
    ],
  },
  '4': {
    id: '4',
    name: 'Rosetta',
    cuisine: 'Italian',
    rating: 4.7,
    reviewCount: 428,
    priceRange: '$$$',
    coordinates: [-122.083, 37.418],
    address: '321 California Ave, Palo Alto, CA',
    phone: '+1 650 533 7804',
    description: 'Elegant Italian dining in a beautiful setting',
    imageUrl: 'https://via.placeholder.com/400x200',
    isOpen: true,
    openingHours: {
      monday: { open: '08:00', close: '24:00' },
      tuesday: { open: '08:00', close: '24:00' },
      wednesday: { open: '08:00', close: '24:00' },
      thursday: { open: '08:00', close: '24:00' },
      friday: { open: '08:00', close: '01:00' },
      saturday: { open: '09:00', close: '01:00' },
      sunday: { open: '09:00', close: '23:00' },
    },
    paymentMethods: {
      acceptsCards: false,
      acceptsCash: true,
      acceptsDigitalPayments: false,
    },
    menu: [
      {
        id: 'appetizers',
        name: 'Appetizers',
        items: [
          {
            id: 'app_1',
            name: 'Burrata with Heirloom Tomatoes',
            price: 16.99,
            description: 'Creamy burrata with fresh tomatoes and basil',
            ingredients: ['burrata', 'tomatoes', 'basil', 'olive oil', 'balsamic'],
            isVegetarian: true,
            isVegan: false,
            calories: 280,
          },
          {
            id: 'app_2',
            name: 'Carpaccio di Manzo',
            price: 18.99,
            description: 'Thinly sliced beef with arugula and parmesan',
            ingredients: ['beef', 'arugula', 'parmesan', 'capers', 'lemon'],
            isVegetarian: false,
            isVegan: false,
            calories: 220,
          },
        ],
      },
      {
        id: 'salads',
        name: 'Salads',
        items: [
          {
            id: 'sal_1',
            name: 'Insalata Tricolore',
            price: 14.99,
            description: 'Arugula, radicchio, and endive salad',
            ingredients: ['arugula', 'radicchio', 'endive', 'parmesan', 'lemon dressing'],
            isVegetarian: true,
            isVegan: false,
            calories: 180,
          },
        ],
      },
      {
        id: 'entrees',
        name: 'Entrées',
        items: [
          {
            id: 'ent_1',
            name: 'Handmade Pasta with Truffle',
            price: 28.0,
            description: 'Fresh pasta with seasonal truffle and parmesan',
            ingredients: ['pasta', 'black truffle', 'parmesan', 'butter', 'herbs'],
            isVegetarian: true,
            isVegan: false,
            calories: 520,
          },
          {
            id: 'ent_2',
            name: 'Osso Buco Milanese',
            price: 42.0,
            description: 'Braised veal shanks with saffron risotto',
            ingredients: ['veal', 'saffron risotto', 'vegetables', 'white wine'],
            isVegetarian: false,
            isVegan: false,
            calories: 680,
          },
          {
            id: 'ent_3',
            name: 'Branzino al Forno',
            price: 36.0,
            description: 'Roasted Mediterranean sea bass',
            ingredients: ['sea bass', 'herbs', 'lemon', 'olive oil', 'vegetables'],
            isVegetarian: false,
            isVegan: false,
            calories: 420,
          },
        ],
      },
      {
        id: 'drinks',
        name: 'Drinks',
        items: [
          {
            id: 'drk_1',
            name: 'Aperol Spritz',
            price: 12.0,
            description: 'Classic Italian aperitif',
            ingredients: ['aperol', 'prosecco', 'soda water', 'orange'],
            isVegetarian: true,
            isVegan: true,
            calories: 160,
          },
          {
            id: 'drk_2',
            name: 'Espresso',
            price: 4.0,
            description: 'Traditional Italian coffee',
            ingredients: ['coffee'],
            isVegetarian: true,
            isVegan: true,
            calories: 5,
          },
        ],
      },
      {
        id: 'desserts',
        name: 'Desserts',
        items: [
          {
            id: 'des_1',
            name: 'Tiramisu',
            price: 12.0,
            description: 'Classic Italian dessert',
            ingredients: ['mascarpone', 'espresso', 'ladyfingers', 'cocoa'],
            isVegetarian: true,
            isVegan: false,
            calories: 380,
          },
          {
            id: 'des_2',
            name: 'Panna Cotta',
            price: 10.0,
            description: 'Creamy vanilla dessert with berry compote',
            ingredients: ['cream', 'vanilla', 'gelatin', 'berries'],
            isVegetarian: true,
            isVegan: false,
            calories: 320,
          },
        ],
      },
    ],
  },
  '5': {
    id: '5',
    name: 'Quintonil',
    cuisine: 'Contemporary Mexican',
    rating: 4.9,
    reviewCount: 756,
    priceRange: '$$$$',
    coordinates: [-122.084, 37.422],
    address: '654 Middlefield Rd, Palo Alto, CA',
    phone: '+1 650 280 2680',
    description: 'Innovative Mexican cuisine with local ingredients',
    imageUrl: 'https://via.placeholder.com/400x200',
    isOpen: true,
    openingHours: {
      monday: { open: '13:30', close: '23:00' },
      tuesday: { open: '13:30', close: '23:00' },
      wednesday: { open: '13:30', close: '23:00' },
      thursday: { open: '13:30', close: '23:00' },
      friday: { open: '13:30', close: '24:00' },
      saturday: { open: '13:30', close: '24:00' },
      sunday: { open: '13:30', close: '22:00' },
    },
    paymentMethods: {
      acceptsCards: true,
      acceptsCash: false,
      acceptsDigitalPayments: true,
    },
    menu: [
      {
        id: 'appetizers',
        name: 'Appetizers',
        items: [
          {
            id: 'app_1',
            name: 'Esquites with Epazote',
            price: 14.0,
            description: 'Corn kernels with herbs and cheese',
            ingredients: ['corn', 'epazote', 'cheese', 'lime', 'chili powder'],
            isVegetarian: true,
            isVegan: false,
            calories: 220,
          },
          {
            id: 'app_2',
            name: 'Ceviche Verde',
            price: 22.0,
            description: 'Fresh fish with green sauce',
            ingredients: ['fish', 'lime', 'serrano', 'cilantro', 'avocado'],
            isVegetarian: false,
            isVegan: false,
            calories: 180,
          },
        ],
      },
      {
        id: 'entrees',
        name: 'Entrées',
        items: [
          {
            id: 'ent_1',
            name: 'Corn with Chicatana Ant',
            price: 38.0,
            description: 'Heritage corn with traditional chicatana ant',
            ingredients: ['heirloom corn', 'chicatana ant', 'herbs', 'salsa macha'],
            isVegetarian: false,
            isVegan: false,
            calories: 340,
          },
          {
            id: 'ent_2',
            name: 'Duck with Mole Poblano',
            price: 55.0,
            description: 'Slow-cooked duck breast with mole poblano',
            ingredients: ['duck', 'mole poblano', 'sesame', 'rice', 'vegetables'],
            isVegetarian: false,
            isVegan: false,
            calories: 620,
          },
          {
            id: 'ent_3',
            name: 'Mushroom Tlayuda',
            price: 32.0,
            description: 'Crispy tortilla with wild mushrooms',
            ingredients: ['tortilla', 'wild mushrooms', 'beans', 'cheese', 'herbs'],
            isVegetarian: true,
            isVegan: false,
            calories: 480,
          },
        ],
      },
      {
        id: 'drinks',
        name: 'Drinks',
        items: [
          {
            id: 'drk_1',
            name: 'Mezcal Flight',
            price: 28.0,
            description: 'Selection of three artisanal mezcals',
            ingredients: ['mezcal'],
            isVegetarian: true,
            isVegan: true,
            calories: 240,
          },
          {
            id: 'drk_2',
            name: 'Agua de Xoconostle',
            price: 6.0,
            description: 'Prickly pear cactus water',
            ingredients: ['xoconostle', 'sugar', 'water'],
            isVegetarian: true,
            isVegan: true,
            calories: 90,
          },
        ],
      },
      {
        id: 'desserts',
        name: 'Desserts',
        items: [
          {
            id: 'des_1',
            name: 'Cajeta Ice Cream',
            price: 14.0,
            description: 'Goat milk caramel ice cream',
            ingredients: ['goat milk', 'cajeta', 'cream', 'vanilla'],
            isVegetarian: true,
            isVegan: false,
            calories: 280,
          },
        ],
      },
    ],
  },
};

// Helper function to get restaurant menu by ID
export const getRestaurantMenu = (restaurantId: string): DetailedRestaurant | undefined => {
  return mockRestaurantMenus[restaurantId];
};

// Helper function to get all menu items from a restaurant
export const getAllMenuItems = (restaurantId: string): MenuItem[] => {
  const restaurant = mockRestaurantMenus[restaurantId];
  if (!restaurant) return [];

  return restaurant.menu.flatMap(category => category.items);
};

// Helper function to get vegetarian items
export const getVegetarianItems = (restaurantId: string): MenuItem[] => {
  const items = getAllMenuItems(restaurantId);
  return items.filter(item => item.isVegetarian);
};

// Helper function to get vegan items
export const getVeganItems = (restaurantId: string): MenuItem[] => {
  const items = getAllMenuItems(restaurantId);
  return items.filter(item => item.isVegan);
};
