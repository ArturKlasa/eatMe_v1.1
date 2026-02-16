/**
 * Onboarding Store
 *
 * Manages user onboarding flow and preference collection.
 * Tracks progress, form data, and completion status.
 */

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';

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

    // Save to Supabase
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('No authenticated user');
      }

      // Prepare data for Supabase
      const preferencesData = {
        user_id: user.id,
        diet_type: state.formData.dietType,
        protein_preferences: state.formData.proteinPreferences,
        allergies: state.formData.allergies,
        favorite_cuisines: state.formData.favoriteCuisines,
        favorite_dishes: state.formData.favoriteDishes,
        spice_tolerance: state.formData.spiceTolerance,
        onboarding_completed: true,
        onboarding_completed_at: new Date().toISOString(),
        preferences_updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('user_preferences')
        .upsert(preferencesData, {
          onConflict: 'user_id',
        });

      if (error) throw error;

      console.log('[Onboarding] Preferences saved to Supabase');
    } catch (error) {
      console.error('[Onboarding] Failed to save to Supabase:', error);
      throw error; // Re-throw to show error in UI
    }

    set({
      isCompleted: true,
      isVisible: false,
    });

    // Calculate completion stats
    get().updateProfileStats();

    // Also save to AsyncStorage as backup
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
      console.error('[Onboarding] Failed to save to AsyncStorage:', error);
    }
  },

  // Data management
  loadUserPreferences: async (userId: string) => {
    try {
      // Load from Supabase
      const { data, error } = await supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) {
        // If no preferences exist yet (PGRST116), that's okay
        if (error.code === 'PGRST116') {
          console.log('[Onboarding] No preferences found for user');
          return;
        }
        throw error;
      }

      if (data) {
        // Map database columns to form data
        const formData: OnboardingFormData = {
          dietType: data.diet_type || 'all',
          proteinPreferences: data.protein_preferences || [],
          allergies: data.allergies || [],
          favoriteCuisines: data.favorite_cuisines || [],
          favoriteDishes: data.favorite_dishes || [],
          spiceTolerance: data.spice_tolerance || 'medium',
        };

        set({
          formData,
          isCompleted: data.onboarding_completed || false,
          profileCompletion: data.profile_completion_percentage || 0,
          profilePoints: data.profile_points || 0,
          lastPromptShown: data.last_prompt_shown_at 
            ? new Date(data.last_prompt_shown_at) 
            : null,
        });

        console.log('[Onboarding] Preferences loaded from Supabase');
      }
    } catch (error) {
      console.error('[Onboarding] Failed to load from Supabase:', error);
      
      // Fallback to AsyncStorage
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
    }
  },

  savePreferences: async (userId: string) => {
    const state = get();

    // Save to Supabase
    try {
      const preferencesData = {
        user_id: userId,
        diet_type: state.formData.dietType,
        protein_preferences: state.formData.proteinPreferences,
        allergies: state.formData.allergies,
        favorite_cuisines: state.formData.favoriteCuisines,
        favorite_dishes: state.formData.favoriteDishes,
        spice_tolerance: state.formData.spiceTolerance,
        onboarding_completed: state.isCompleted,
        preferences_updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('user_preferences')
        .upsert(preferencesData, {
          onConflict: 'user_id',
        });

      if (error) throw error;

      console.log('[Onboarding] Preferences saved to Supabase');
    } catch (error) {
      console.error('[Onboarding] Failed to save to Supabase:', error);
    }

    // Also save to AsyncStorage as backup
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
      console.error('[Onboarding] Failed to save to AsyncStorage:', error);
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
    
    // Save timestamp to Supabase
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        supabase
          .from('user_preferences')
          .update({ last_prompt_shown_at: new Date().toISOString() })
          .eq('user_id', user.id)
          .then(({ error }) => {
            if (error) console.error('[Onboarding] Failed to update prompt timestamp:', error);
          });
      }
    });
  },

  recordPromptShown: () => {
    set({ lastPromptShown: new Date() });
    
    // Save timestamp to Supabase
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        supabase
          .from('user_preferences')
          .update({ last_prompt_shown_at: new Date().toISOString() })
          .eq('user_id', user.id)
          .then(({ error }) => {
            if (error) console.error('[Onboarding] Failed to record prompt timestamp:', error);
          });
      }
    });
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
