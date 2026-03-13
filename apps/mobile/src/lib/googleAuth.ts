/**
 * Native Google Sign-In helper for EatMe mobile app.
 *
 * Uses @react-native-google-signin/google-signin to present the OS-level
 * account picker so users can authenticate with one tap — no password entry.
 *
 * Flow:
 *   configureGoogleSignIn()        ← call once at app startup (App.tsx)
 *   signInWithGoogle()             ← call from authStore.signInWithOAuth('google')
 *     └─ GoogleSignin.signIn()     ← OS native account picker (no browser/password)
 *     └─ returns idToken
 *     └─ supabase.auth.signInWithIdToken({ provider: 'google', token: idToken })
 *
 * Prerequisites:
 *   - EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID must be set in .env
 *     (the *Web* client ID from Google Cloud Console, NOT the Android/iOS one)
 *   - Android: A native Android OAuth client (package: com.eatme.app + SHA-1) must
 *     exist in Google Cloud Console so the device trusts the sign-in request.
 *   - iOS: A native iOS OAuth client (bundle: com.eatme.app) must exist in GCC.
 *   - npx expo prebuild --clean must be run after first adding this package.
 */

import {
  GoogleSignin,
  statusCodes,
  isErrorWithCode,
} from '@react-native-google-signin/google-signin';
import { supabase } from './supabase';
import { debugLog } from '../config/environment';

// ─── Configuration ────────────────────────────────────────────────────────────

/**
 * Configure the native Google Sign-In SDK.
 *
 * Called automatically at app startup (App.tsx) AND again inside
 * signInWithGoogle() immediately before any native call. This double-call is
 * intentional: it guarantees the native _apiClient is always initialised even
 * with the new architecture (TurboModules/JSI), where module-level code does
 * not have a serialised ordering guarantee with the native module queue.
 *
 * GoogleSignin.configure() is idempotent — repeated calls just replace the
 * internal configPromise, which signIn() awaits before touching the native layer.
 */
export function configureGoogleSignIn(): void {
  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

  if (!webClientId || webClientId === 'YOUR_WEB_CLIENT_ID.apps.googleusercontent.com') {
    console.warn(
      '[GoogleAuth] EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID is not set. ' +
        'Native Google Sign-In will not work. ' +
        'See apps/mobile/.env.example for instructions.'
    );
    return;
  }

  GoogleSignin.configure({
    webClientId,
    offlineAccess: false,
    scopes: ['profile', 'email'],
  });

  debugLog('[GoogleAuth] GoogleSignin configured.');
}

// ─── Sign-in ─────────────────────────────────────────────────────────────────

export interface GoogleAuthResult {
  error: Error | null;
}

/**
 * Trigger the native OS Google account picker and exchange the resulting
 * ID token for a Supabase session.
 *
 * Returns { error: null } on success, { error: Error } on failure.
 * The Supabase session is stored automatically via supabase.auth.onAuthStateChange.
 */
export async function signInWithGoogle(): Promise<GoogleAuthResult> {
  try {
    // Configure immediately before every sign-in attempt.
    //
    // WHY here and not just at module load / App.tsx?
    // With newArchEnabled=true (TurboModules/JSI), there is no serialised
    // ordering guarantee between module-level JS code and the native module
    // queue. Calling configure() synchronously here — right before
    // hasPlayServices() and signIn() — guarantees the library's internal
    // configPromise is always a freshly-set Promise that signIn() will await
    // before touching the native _apiClient.
    configureGoogleSignIn();

    debugLog('[GoogleAuth] Checking Google Play Services...');
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

    debugLog('[GoogleAuth] Starting native Google sign-in...');
    const response = await GoogleSignin.signIn();

    // v16: cancellation is a returned discriminated union, NOT a thrown error
    if (response.type === 'cancelled') {
      debugLog('[GoogleAuth] User cancelled the sign-in flow.');
      return { error: new Error('OAuth cancelled') };
    }

    // response.type === 'success'
    const idToken = response.data?.idToken;

    if (!idToken) {
      const err = new Error('Google Sign-In did not return an ID token.');
      console.error('[GoogleAuth]', err.message);
      return { error: err };
    }

    debugLog('[GoogleAuth] Got ID token, exchanging with Supabase...');

    const { error: supabaseError } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: idToken,
    });

    if (supabaseError) {
      console.error('[GoogleAuth] Supabase signInWithIdToken error:', supabaseError);
      return { error: supabaseError };
    }

    debugLog('[GoogleAuth] Supabase session created successfully.');
    return { error: null };
  } catch (err) {
    // Only actual errors reach here (Play Services unavailable, sign-in already
    // in progress, network failures, etc.) — cancellation never throws in v16.
    if (isErrorWithCode(err)) {
      switch (err.code) {
        case statusCodes.IN_PROGRESS:
          debugLog('[GoogleAuth] Sign-in already in progress.');
          return { error: new Error('Google Sign-In already in progress') };

        case statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
          console.error('[GoogleAuth] Google Play Services not available.');
          return { error: new Error('Google Play Services is not available on this device') };

        default:
          console.error('[GoogleAuth] Unknown Google error code:', err.code, err.message);
          return { error: err as Error };
      }
    }

    console.error('[GoogleAuth] Unexpected error:', err);
    return { error: err as Error };
  }
}

/**
 * Sign out from Google native SDK.
 * Call this alongside supabase.auth.signOut() so the account picker
 * doesn't silently re-authenticate the same account on next sign-in.
 */
export async function signOutFromGoogle(): Promise<void> {
  try {
    const isSignedIn = await GoogleSignin.getCurrentUser();
    if (isSignedIn) {
      await GoogleSignin.signOut();
      debugLog('[GoogleAuth] Signed out from Google.');
    }
  } catch (err) {
    // Non-fatal — Supabase session is already invalidated
    console.warn('[GoogleAuth] Failed to sign out from Google SDK:', err);
  }
}
