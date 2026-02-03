/**
 * Rating System Types
 *
 * Types for the dish and restaurant rating/review system.
 */

// Opinion values for dish ratings
export type DishOpinion = 'liked' | 'okay' | 'disliked';

// Tags users can select for dish ratings
export type DishTag =
  | 'flavor'
  | 'portion'
  | 'presentation'
  | 'value'
  | 'fresh'
  | 'too_salty'
  | 'too_bland'
  | 'portion_small'
  | 'not_fresh'
  | 'not_as_described';

// Positive tags (shown when user likes dish)
export const POSITIVE_DISH_TAGS: DishTag[] = [
  'flavor',
  'portion',
  'presentation',
  'value',
  'fresh',
];

// Negative tags (shown when user dislikes dish)
export const NEGATIVE_DISH_TAGS: DishTag[] = [
  'too_salty',
  'too_bland',
  'portion_small',
  'not_fresh',
  'not_as_described',
];

// Tag display labels
export const DISH_TAG_LABELS: Record<DishTag, string> = {
  flavor: 'Great flavor',
  portion: 'Good portion',
  presentation: 'Beautiful',
  value: 'Good value',
  fresh: 'Very fresh',
  too_salty: 'Too salty',
  too_bland: 'Too bland',
  portion_small: 'Small portion',
  not_fresh: 'Not fresh',
  not_as_described: 'Not as described',
};

// Restaurant experience question types
export type RestaurantQuestionType =
  | 'service_friendly'
  | 'cleanliness'
  | 'wait_time'
  | 'value_for_money'
  | 'would_recommend'
  | 'ambiance';

// Question display text
export const RESTAURANT_QUESTIONS: Record<RestaurantQuestionType, string> = {
  service_friendly: 'Was the service friendly?',
  cleanliness: 'Was the restaurant clean?',
  wait_time: 'Was the wait time reasonable?',
  value_for_money: 'Was it good value for money?',
  would_recommend: 'Would you recommend this place?',
  ambiance: 'Did you enjoy the atmosphere?',
};

// Session view tracking
export interface SessionView {
  entityType: 'restaurant' | 'dish' | 'menu';
  entityId: string;
  viewedAt: Date;
  durationSeconds?: number;
}

// Recently viewed restaurant for rating prompt
export interface RecentlyViewedRestaurant {
  id: string;
  name: string;
  cuisine: string;
  imageUrl?: string;
  viewedAt: Date;
  viewedDishes: RecentlyViewedDish[];
}

// Recently viewed dish
export interface RecentlyViewedDish {
  id: string;
  name: string;
  price: number;
  imageUrl?: string;
  viewedAt: Date;
}

// Dish rating being submitted
export interface DishRatingInput {
  dishId: string;
  dishName: string;
  opinion: DishOpinion;
  tags: DishTag[];
  photoUri?: string;
}

// Restaurant feedback being submitted
export interface RestaurantFeedbackInput {
  restaurantId: string;
  questionType: RestaurantQuestionType;
  response: boolean;
  photoUri?: string; // Restaurant photo (interior/exterior)
}

// Complete rating submission
export interface RatingSubmission {
  restaurantId: string;
  visitedAt: Date;
  dishRatings: DishRatingInput[];
  restaurantFeedback?: RestaurantFeedbackInput;
}

// Points earned breakdown
export interface PointsEarned {
  dishRatings: number; // 10 pts per dish
  dishTags: number; // 5 pts for adding tags
  dishPhotos: number; // 15 pts per photo
  restaurantFeedback: number; // 5 pts
  restaurantPhoto: number; // 10 pts
  firstVisitBonus: number; // 20 pts for first rating at restaurant
  total: number;
}

// Rating flow state
export interface RatingFlowState {
  step: 'select_restaurant' | 'select_dishes' | 'rate_dish' | 'restaurant_question' | 'complete';
  selectedRestaurant: RecentlyViewedRestaurant | null;
  selectedDishes: RecentlyViewedDish[];
  currentDishIndex: number;
  dishRatings: DishRatingInput[];
  restaurantFeedback: RestaurantFeedbackInput | null;
  randomQuestion: RestaurantQuestionType;
  pointsEarned: PointsEarned;
}

// Aggregated dish rating (for display)
export interface DishRatingStats {
  dishId: string;
  likePercentage: number;
  okayPercentage: number;
  dislikePercentage: number;
  totalRatings: number;
  topTags: DishTag[];
}

// Aggregated restaurant rating (for display)
export interface RestaurantRatingStats {
  restaurantId: string;
  overallPercentage: number;
  foodPercentage: number;
  servicePercentage: number;
  cleanlinessPercentage: number;
  valuePercentage: number;
  totalRatings: number;
}
