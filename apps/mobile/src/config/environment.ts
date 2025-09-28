/**
 * Environment configuration utility for EatMe mobile app
 *
 * This module provides type-safe access to environment variables
 * and validates required configurations at startup.
 */

interface EnvironmentConfig {
  // Mapbox Configuration
  mapbox: {
    accessToken: string;
    defaultLocation: {
      latitude: number;
      longitude: number;
      zoom: number;
    };
  };

  // API Configuration
  api: {
    baseUrl: string;
  };

  // App Configuration
  app: {
    debug: boolean;
    environment: 'development' | 'staging' | 'production';
  };
}

/**
 * Validates and returns the environment configuration
 * Throws an error if required environment variables are missing
 */
function getEnvironmentConfig(): EnvironmentConfig {
  // Get environment variables with EXPO_PUBLIC_ prefix
  const mapboxToken = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN;
  const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
  const debug = process.env.EXPO_PUBLIC_DEBUG === 'true';
  const defaultLat = parseFloat(process.env.EXPO_PUBLIC_DEFAULT_LAT || '19.4326');
  const defaultLng = parseFloat(process.env.EXPO_PUBLIC_DEFAULT_LNG || '-99.1332');
  const defaultZoom = parseInt(process.env.EXPO_PUBLIC_DEFAULT_ZOOM || '12', 10);

  // Validate required environment variables
  if (!mapboxToken) {
    throw new Error(
      'EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN is required. Please check your .env file and docs/mapbox-setup.md'
    );
  }

  if (!mapboxToken.startsWith('pk.')) {
    throw new Error('EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN must be a public token starting with "pk."');
  }

  // Validate coordinates are within valid ranges
  if (defaultLat < -90 || defaultLat > 90) {
    throw new Error('Invalid default latitude. Must be between -90 and 90.');
  }

  if (defaultLng < -180 || defaultLng > 180) {
    throw new Error('Invalid default longitude. Must be between -180 and 180.');
  }

  return {
    mapbox: {
      accessToken: mapboxToken,
      defaultLocation: {
        latitude: defaultLat,
        longitude: defaultLng,
        zoom: defaultZoom,
      },
    },
    api: {
      baseUrl: apiUrl,
    },
    app: {
      debug,
      environment: __DEV__ ? 'development' : 'production',
    },
  };
}

/**
 * Environment configuration instance
 * This will be validated when the module is imported
 */
export const ENV = getEnvironmentConfig();

/**
 * Helper function to check if we're in development mode
 */
export const isDevelopment = (): boolean => ENV.app.environment === 'development';

/**
 * Helper function to log debug information (only in development)
 */
export const debugLog = (message: string, ...args: any[]): void => {
  if (ENV.app.debug && isDevelopment()) {
    console.log(`[EatMe Debug] ${message}`, ...args);
  }
};

export default ENV;
