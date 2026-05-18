// useAppVersionGate — Phase 6 force-upgrade gate hook.
//
// On mount, fetches public.app_config via the app-config edge function and
// compares the installed app version to min_supported_mobile_version. If the
// installed version is BELOW the floor, returns the config (the caller renders
// a blocking modal). Otherwise returns null (the app proceeds normally).
//
// Fail-open: if the fetch fails and no cached config exists, returns null.
// We'd rather risk a stale-floor pass than lock the user base out when the
// server is unavailable.
//
// See docs/plans/dish-model-rewrite-phase-1-database.md §6.

import * as Application from 'expo-application';
import { useEffect, useState } from 'react';

import { AppConfig, fetchAppConfig } from '../services/appConfigService';

/**
 * Returns the AppConfig if the installed app version is BELOW the floor
 * (caller should render a blocking modal). Returns null otherwise.
 */
export function useAppVersionGate(): AppConfig | null {
  const [gate, setGate] = useState<AppConfig | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetchAppConfig().then(cfg => {
      if (cancelled || !cfg) return;
      const installed = Application.nativeApplicationVersion ?? '0.0.0';
      if (compareSemver(installed, cfg.min_supported_mobile_version) < 0) {
        setGate(cfg);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return gate;
}

/**
 * Lightweight semver compare. Returns negative if a<b, positive if a>b, zero if equal.
 * Tolerates missing patch (treats as 0). Ignores pre-release suffixes (-beta etc.) —
 * the floor is always a release version, so this is safe for the version-gate use case.
 */
export function compareSemver(a: string, b: string): number {
  const parse = (v: string) =>
    v
      .split('-')[0]
      .split('.')
      .map(part => Number.parseInt(part, 10) || 0);
  const av = parse(a);
  const bv = parse(b);
  for (let i = 0; i < 3; i++) {
    const diff = (av[i] ?? 0) - (bv[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}
