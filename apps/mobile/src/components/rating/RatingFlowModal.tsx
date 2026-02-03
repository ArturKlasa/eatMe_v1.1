/**
 * Rating Flow Modal
 *
 * Main orchestrator for the complete rating flow.
 * Manages state transitions between all rating screens.
 */

import React, { useState, useCallback } from 'react';
import { Modal, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

import { SelectRestaurantScreen } from './SelectRestaurantScreen';
import { SelectDishesScreen } from './SelectDishesScreen';
import { RateDishScreen } from './RateDishScreen';
import { RestaurantQuestionScreen } from './RestaurantQuestionScreen';
import { RatingCompleteScreen } from './RatingCompleteScreen';

import {
  RecentlyViewedRestaurant,
  RecentlyViewedDish,
  DishRatingInput,
  RestaurantFeedbackInput,
  RestaurantQuestionType,
  PointsEarned,
  RESTAURANT_QUESTIONS,
} from '../../types/rating';

type FlowStep =
  | 'select_restaurant'
  | 'select_dishes'
  | 'rate_dish'
  | 'restaurant_question'
  | 'complete';

interface RatingFlowModalProps {
  visible: boolean;
  recentRestaurants: RecentlyViewedRestaurant[];
  onClose: () => void;
  onComplete: (submission: {
    restaurantId: string;
    dishRatings: DishRatingInput[];
    restaurantFeedback: RestaurantFeedbackInput | null;
  }) => Promise<void>;
  onSearchRestaurant: () => void; // When user taps "I ate somewhere else"
  onViewRewards: () => void;
  // Function to get all dishes for a restaurant
  getRestaurantDishes: (restaurantId: string) => Promise<RecentlyViewedDish[]>;
  // Check if this is user's first rating at this restaurant
  isFirstVisit: (restaurantId: string) => Promise<boolean>;
}

// Get a random restaurant question
const getRandomQuestion = (): RestaurantQuestionType => {
  const questions = Object.keys(RESTAURANT_QUESTIONS) as RestaurantQuestionType[];
  return questions[Math.floor(Math.random() * questions.length)];
};

// Calculate points earned
const calculatePoints = (
  dishRatings: DishRatingInput[],
  restaurantFeedback: RestaurantFeedbackInput | null,
  isFirstVisit: boolean
): PointsEarned => {
  const dishRatingPoints = dishRatings.length * 10;
  const dishTagPoints = dishRatings.filter(r => r.tags.length > 0).length * 5;
  const dishPhotoPoints = dishRatings.filter(r => r.photoUri).length * 15;
  const restaurantFeedbackPoints = restaurantFeedback ? 5 : 0;
  const restaurantPhotoPoints = restaurantFeedback?.photoUri ? 10 : 0;
  const firstVisitBonus = isFirstVisit ? 20 : 0;

  return {
    dishRatings: dishRatingPoints,
    dishTags: dishTagPoints,
    dishPhotos: dishPhotoPoints,
    restaurantFeedback: restaurantFeedbackPoints,
    restaurantPhoto: restaurantPhotoPoints,
    firstVisitBonus,
    total:
      dishRatingPoints +
      dishTagPoints +
      dishPhotoPoints +
      restaurantFeedbackPoints +
      restaurantPhotoPoints +
      firstVisitBonus,
  };
};

export function RatingFlowModal({
  visible,
  recentRestaurants,
  onClose,
  onComplete,
  onSearchRestaurant,
  onViewRewards,
  getRestaurantDishes,
  isFirstVisit,
}: RatingFlowModalProps) {
  const [step, setStep] = useState<FlowStep>('select_restaurant');
  const [selectedRestaurant, setSelectedRestaurant] = useState<RecentlyViewedRestaurant | null>(
    null
  );
  const [allDishes, setAllDishes] = useState<RecentlyViewedDish[]>([]);
  const [selectedDishes, setSelectedDishes] = useState<RecentlyViewedDish[]>([]);
  const [currentDishIndex, setCurrentDishIndex] = useState(0);
  const [dishRatings, setDishRatings] = useState<DishRatingInput[]>([]);
  const [restaurantFeedback, setRestaurantFeedback] = useState<RestaurantFeedbackInput | null>(
    null
  );
  const [randomQuestion] = useState<RestaurantQuestionType>(getRandomQuestion);
  const [pointsEarned, setPointsEarned] = useState<PointsEarned | null>(null);
  const [isFirstVisitFlag, setIsFirstVisitFlag] = useState(false);

  // Reset state when modal opens/closes
  const resetState = useCallback(() => {
    setStep('select_restaurant');
    setSelectedRestaurant(null);
    setAllDishes([]);
    setSelectedDishes([]);
    setCurrentDishIndex(0);
    setDishRatings([]);
    setRestaurantFeedback(null);
    setPointsEarned(null);
  }, []);

  // Handle selecting a restaurant
  const handleSelectRestaurant = useCallback(
    async (restaurant: RecentlyViewedRestaurant) => {
      setSelectedRestaurant(restaurant);

      // Check if first visit
      const firstVisit = await isFirstVisit(restaurant.id);
      setIsFirstVisitFlag(firstVisit);

      // Fetch all dishes for this restaurant
      const dishes = await getRestaurantDishes(restaurant.id);
      setAllDishes(dishes);

      setStep('select_dishes');
    },
    [getRestaurantDishes, isFirstVisit]
  );

  // Handle selecting dishes
  const handleSelectDishes = useCallback((dishes: RecentlyViewedDish[]) => {
    setSelectedDishes(dishes);
    setCurrentDishIndex(0);
    setStep('rate_dish');
  }, []);

  // Handle submitting a dish rating
  const handleDishRating = useCallback(
    (rating: DishRatingInput) => {
      setDishRatings(prev => [...prev, rating]);

      if (currentDishIndex < selectedDishes.length - 1) {
        // More dishes to rate
        setCurrentDishIndex(prev => prev + 1);
      } else {
        // All dishes rated, go to restaurant question
        setStep('restaurant_question');
      }
    },
    [currentDishIndex, selectedDishes.length]
  );

  // Handle restaurant feedback submission
  const handleRestaurantFeedback = useCallback(
    async (feedback: RestaurantFeedbackInput) => {
      setRestaurantFeedback(feedback);

      // Calculate points
      const points = calculatePoints([...dishRatings], feedback, isFirstVisitFlag);
      setPointsEarned(points);

      // Submit to backend
      await onComplete({
        restaurantId: selectedRestaurant!.id,
        dishRatings,
        restaurantFeedback: feedback,
      });

      setStep('complete');
    },
    [dishRatings, isFirstVisitFlag, onComplete, selectedRestaurant]
  );

  // Handle skipping restaurant question
  const handleSkipRestaurantQuestion = useCallback(async () => {
    // Calculate points without restaurant feedback
    const points = calculatePoints([...dishRatings], null, isFirstVisitFlag);
    setPointsEarned(points);

    // Submit to backend
    await onComplete({
      restaurantId: selectedRestaurant!.id,
      dishRatings,
      restaurantFeedback: null,
    });

    setStep('complete');
  }, [dishRatings, isFirstVisitFlag, onComplete, selectedRestaurant]);

  // Handle back navigation
  const handleBack = useCallback(() => {
    switch (step) {
      case 'select_dishes':
        setStep('select_restaurant');
        setSelectedRestaurant(null);
        break;
      case 'rate_dish':
        if (currentDishIndex > 0) {
          // Go back to previous dish
          setCurrentDishIndex(prev => prev - 1);
          setDishRatings(prev => prev.slice(0, -1));
        } else {
          // Go back to dish selection
          setStep('select_dishes');
          setDishRatings([]);
        }
        break;
      case 'restaurant_question':
        // Go back to last dish
        setCurrentDishIndex(selectedDishes.length - 1);
        setDishRatings(prev => prev.slice(0, -1));
        setStep('rate_dish');
        break;
    }
  }, [step, currentDishIndex, selectedDishes.length]);

  // Handle photo picking
  const handleAddPhoto = useCallback(async (): Promise<string | undefined> => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permissionResult.granted) {
      Alert.alert('Permission Required', 'Please allow access to your photos to add images.', [
        { text: 'OK' },
      ]);
      return undefined;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      return result.assets[0].uri;
    }

    return undefined;
  }, []);

  // Handle modal close
  const handleClose = useCallback(() => {
    resetState();
    onClose();
  }, [resetState, onClose]);

  // Handle done on complete screen
  const handleDone = useCallback(() => {
    resetState();
    onClose();
  }, [resetState, onClose]);

  // Render current step
  const renderStep = () => {
    switch (step) {
      case 'select_restaurant':
        return (
          <SelectRestaurantScreen
            restaurants={recentRestaurants}
            onSelectRestaurant={handleSelectRestaurant}
            onAteSomewhereElse={() => {
              handleClose();
              onSearchRestaurant();
            }}
            onCancel={handleClose}
          />
        );

      case 'select_dishes':
        return selectedRestaurant ? (
          <SelectDishesScreen
            restaurant={selectedRestaurant}
            allDishes={allDishes}
            onContinue={handleSelectDishes}
            onBack={handleBack}
          />
        ) : null;

      case 'rate_dish':
        return selectedDishes[currentDishIndex] ? (
          <RateDishScreen
            dish={selectedDishes[currentDishIndex]}
            currentIndex={currentDishIndex}
            totalDishes={selectedDishes.length}
            onSubmit={handleDishRating}
            onBack={handleBack}
            onAddPhoto={handleAddPhoto}
          />
        ) : null;

      case 'restaurant_question':
        return selectedRestaurant ? (
          <RestaurantQuestionScreen
            restaurantId={selectedRestaurant.id}
            restaurantName={selectedRestaurant.name}
            questionType={randomQuestion}
            onSubmit={handleRestaurantFeedback}
            onSkip={handleSkipRestaurantQuestion}
            onBack={handleBack}
            onAddPhoto={handleAddPhoto}
          />
        ) : null;

      case 'complete':
        return pointsEarned ? (
          <RatingCompleteScreen
            dishRatings={dishRatings}
            restaurantFeedback={restaurantFeedback}
            pointsEarned={pointsEarned}
            onViewRewards={onViewRewards}
            onDone={handleDone}
          />
        ) : null;

      default:
        return null;
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={handleClose}
    >
      {renderStep()}
    </Modal>
  );
}
