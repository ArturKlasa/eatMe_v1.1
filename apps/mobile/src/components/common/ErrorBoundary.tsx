/**
 * ErrorBoundary — React class-based error boundary for React Native
 *
 * Function components cannot be error boundaries (React limitation as of React 19).
 * This component catches any unhandled JavaScript error thrown during rendering,
 * in lifecycle methods, or in constructors of the wrapped tree.
 *
 * Usage:
 *   <ErrorBoundary>
 *     <SomeScreen />
 *   </ErrorBoundary>
 *
 *   // Custom fallback UI:
 *   <ErrorBoundary fallback={<MyCustomFallback onRetry={...} />}>
 *     <SomeScreen />
 *   </ErrorBoundary>
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import i18n from '../../i18n/index';
import { colors, typography, spacing, borderRadius } from '@eatme/tokens';

interface Props {
  children: React.ReactNode;
  /** Optional custom fallback. Receives an `onRetry` function that resets the boundary. */
  fallback?: (onRetry: () => void) => React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    // Log to console in dev; swap for a crash-reporting service (e.g. Sentry) in prod
    console.error('[ErrorBoundary] Unhandled error:', error);
    console.error('[ErrorBoundary] Component stack:', info.componentStack);
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): React.ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    if (this.props.fallback) {
      return this.props.fallback(this.handleRetry);
    }

    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.emoji}>🍽️</Text>
          <Text style={styles.title}>{i18n.t('common.somethingWrong')}</Text>
          <Text style={styles.message}>{i18n.t('errors.unexpectedError')}</Text>
          {__DEV__ && this.state.error && (
            <View style={styles.devBox}>
              <Text style={styles.devLabel}>Dev info:</Text>
              <Text style={styles.devText}>{this.state.error.message}</Text>
            </View>
          )}
          <TouchableOpacity style={styles.button} onPress={this.handleRetry}>
            <Text style={styles.buttonText}>{i18n.t('errors.tryAgain')}</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.black,
  },
  content: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing['2xl'],
  },
  emoji: {
    fontSize: typography.size['4xl'],
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: typography.size['2xl'],
    fontWeight: typography.weight.bold,
    color: colors.white,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  message: {
    fontSize: typography.size.base,
    color: colors.gray500,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing['2xl'],
  },
  devBox: {
    backgroundColor: colors.darkSecondary,
    borderRadius: borderRadius.base,
    padding: spacing.md,
    marginBottom: spacing.xl,
    width: '100%',
  },
  devLabel: {
    fontSize: typography.size.xs,
    color: colors.danger,
    fontWeight: typography.weight.semibold,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  devText: {
    fontSize: typography.size.sm,
    color: colors.gray400,
    fontFamily: 'monospace',
  },
  button: {
    backgroundColor: colors.danger,
    paddingHorizontal: spacing['2xl'],
    paddingVertical: 14,
    borderRadius: borderRadius.md,
  },
  buttonText: {
    color: colors.white,
    fontSize: typography.size.base,
    fontWeight: typography.weight.bold,
  },
});
