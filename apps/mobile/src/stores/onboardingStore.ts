/**
 * Onboarding Store
 *
 * Manages user onboarding flow and preference collection.
 * Tracks progress, form data, and completion status.
 */

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface OnboardingFormData {
  // Step 1: Dietary & Allergies
  dietType: 'all' | 'vegetarian' | 'vegan';
  proteinPreferences: string[];
  allergies: string[];

  // Step 2: Cuisines & Dishes
  favoriteCuisines: string[];
  favoriteDishes: string[];
  spiceTolerance: 'none' | 'mild' | 'medium' | 'spicy' | 'very_spicy';
}

interface OnboardingState {
  // Flow state
  currentStep: number;
  totalSteps: number;
  isVisible: boolean;

  // Form data
  formData: OnboardingFormData;

  // Completion tracking
  isCompleted: boolean;
  lastPromptShown: Date | null;

  // Profile stats
  profileCompletion: number;
  profilePoints: number;

  // Actions
  setStep: (step: number) => void;
  nextStep: () => void;
  prevStep: () => void;
  updateFormData: (data: Partial<OnboardingFormData>) => void;

  // Flow control
  showOnboarding: () => void;
  hideOnboarding: () => void;
  skipOnboarding: () => void;
  completeOnboarding: () => Promise<void>;

  // Data management
  loadUserPreferences: (userId: string) => Promise<void>;
  savePreferences: (userId: string) => Promise<void>;
  updateProfileStats: () => void;

  // Prompt management
  shouldShowPrompt: () => boolean;
  dismissPrompt: () => void;
  recordPromptShown: () => void;

  // Reset
  reset: () => void;
}

const TOTAL_STEPS = 2;
const STORAGE_KEY = '@eatme_onboarding';
const PROMPT_COOLDOWN_HOURS = 24; // Show prompt once per day

const defaultFormData: OnboardingFormData = {
  dietType: 'all',
  proteinPreferences: [],
  allergies: [],
  favoriteCuisines: [],
  favoriteDishes: [],
  spiceTolerance: 'medium',
};

export const useOnboardingStore = create<OnboardingState>((set, get) => ({
  // Initial state
  currentStep: 0,
  totalSteps: TOTAL_STEPS,
  isVisible: false,
  formData: defaultFormData,
  isCompleted: false,
  lastPromptShown: null,
  profileCompletion: 0,
  profilePoints: 0,

  // Step navigation
  setStep: (step: number) => set({ currentStep: step }),

  nextStep: () =>
    set(state => ({
      currentStep: Math.min(state.currentStep + 1, state.totalSteps - 1),
    })),

  prevStep: () =>
    set(state => ({
      currentStep: Math.max(state.currentStep - 1, 0),
    })),

  // Update form data
  updateFormData: (data: Partial<OnboardingFormData>) =>
    set(state => ({
      formData: { ...state.formData, ...data },
    })),

  // Flow control
  showOnboarding: () => set({ isVisible: true, currentStep: 0 }),

  hideOnboarding: () => set({ isVisible: false }),

  skipOnboarding: async () => {
    set({
      isVisible: false,
      lastPromptShown: new Date(),
    });

    // Save last prompt time to local storage
    try {
      await AsyncStorage.setItem(`${STORAGE_KEY}_last_prompt`, new Date().toISOString());
    } catch (error) {
      console.error('Failed to save last prompt time:', error);
    }
  },

  completeOnboarding: async () => {
    const state = get();

    set({
      isCompleted: true,
      isVisible: false,
    });

    // Calculate completion stats
    get().updateProfileStats();

    // Save to local storage
    try {
      await AsyncStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          formData: state.formData,
          isCompleted: true,
          completedAt: new Date().toISOString(),
        })
      );
    } catch (error) {
      console.error('Failed to save onboarding data:', error);
    }
  },

  // Data management
  loadUserPreferences: async (userId: string) => {
    // TODO: Load from Supabase
    // For now, load from AsyncStorage
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEY);
      const lastPrompt = await AsyncStorage.getItem(`${STORAGE_KEY}_last_prompt`);

      if (data) {
        const parsed = JSON.parse(data);
        set({
          formData: parsed.formData || defaultFormData,
          isCompleted: parsed.isCompleted || false,
        });
      }

      if (lastPrompt) {
        set({ lastPromptShown: new Date(lastPrompt) });
      }

      get().updateProfileStats();
    } catch (error) {
      console.error('Failed to load user preferences:', error);
    }
  },

  savePreferences: async (userId: string) => {
    const state = get();

    // TODO: Save to Supabase
    // For now, save to AsyncStorage
    try {
      await AsyncStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          formData: state.formData,
          isCompleted: state.isCompleted,
          updatedAt: new Date().toISOString(),
        })
      );
    } catch (error) {
      console.error('Failed to save preferences:', error);
    }
  },

  updateProfileStats: () => {
    const state = get();
    const data = state.formData;

    // Calculate completion percentage
    let score = 0;

    // Core fields (80 points)
    if (data.dietType && data.dietType !== 'all') score += 15;
    if (data.proteinPreferences.length > 0) score += 15;
    if (data.favoriteCuisines.length >= 3) score += 20;
    else if (data.favoriteCuisines.length > 0) score += 10;
    if (data.favoriteDishes.length >= 3) score += 20;
    else if (data.favoriteDishes.length > 0) score += 10;
    if (data.spiceTolerance) score += 10;

    // Optional fields (20 points)
    if (data.allergies.length > 0) score += 5;

    if (data.mealTimes.length > 0) score += 5;
    if (data.diningOccasions.length > 0) score += 5;

    const profileCompletion = Math.min(score, 100);

    // Calculate points
    let points = 0;
    if (state.isCompleted) points += 50;
    if (data.favoriteCuisines.length >= 5) points += 10;
    if (data.favoriteDishes.length >= 5) points += 10;
    if (data.proteinPreferences.length >= 2) points += 10;
    if (data.allergies.length > 0) points += 5;

    set({
      profileCompletion,
      profilePoints: points,
    });
  },

  // Prompt management
  shouldShowPrompt: () => {
    const state = get();

    // Don't show if already completed
    if (state.isCompleted) return false;

    // Check cooldown period (24 hours)
    if (state.lastPromptShown) {
      const hoursSinceLastPrompt =
        (new Date().getTime() - state.lastPromptShown.getTime()) / (1000 * 60 * 60);

      if (hoursSinceLastPrompt < PROMPT_COOLDOWN_HOURS) return false;
    }

    return true;
  },

  dismissPrompt: () => {
    set({ lastPromptShown: new Date() });
  },

  recordPromptShown: () => {
    set({ lastPromptShown: new Date() });
  },

  // Reset
  reset: () =>
    set({
      currentStep: 0,
      isVisible: false,
      formData: defaultFormData,
      isCompleted: false,
      lastPromptShown: null,
      profileCompletion: 0,
      profilePoints: 0,
    }),
}));
