# LOC-06: Commented-Out Code and Stale TODOs

## Current state

### App.tsx — Disabled AppState listener block
`apps/mobile/App.tsx:71-98` contains:
- Line 71-72: Two comment lines explaining the session management is disabled + stale TODO
- Line 77: `// Load previous session data` — restates `loadFromStorage()`
- Line 80: `// Start initial session` — restates `startSession()`
- Lines 83-98: 16 lines — two explanation comments, two stale TODOs, and a `/* */` block containing a full `AppState.addEventListener` subscription + cleanup function that was disabled due to excessive re-renders

The **active code** (lines 73-76, 78-79, 81, 99) calls `loadFromStorage()` and `startSession()` on mount — this stays.

`endSession` is only referenced inside the commented-out block (App.tsx:88, 96) — nowhere else in the file.

### FilterComponents.tsx — Commented-out SpiceLevelFilter
`apps/mobile/src/components/FilterComponents.tsx:331-335`:
- Lines 331-333: JSDoc saying "Currently disabled - not in daily filters"
- Line 334: `// Temporarily disabled - spice level not part of daily filters`
- Line 335: `// export const SpiceLevelFilter: React.FC = () => { return null; };`

`SpiceLevelFilter` has zero imports/references anywhere in the codebase. The component body is `return null` — even if uncommented it does nothing.

## Proposed reduction

### App.tsx — Remove 19 lines, keep 5

**Before** (lines 71-99):
```typescript
  // Session management - disabled to prevent excessive re-renders
  // TODO: Re-enable with proper debouncing
  useEffect(() => {
    const loadFromStorage = useSessionStore.getState().loadFromStorage;
    const startSession = useSessionStore.getState().startSession;

    // Load previous session data
    loadFromStorage();

    // Start initial session
    startSession();

    // Disabled: AppState listener causes too many re-renders
    // TODO: Add debouncing or rate limiting before re-enabling
    /*
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        endSession();
      } else if (nextAppState === 'active') {
        startSession();
      }
    });

    return () => {
      subscription.remove();
      endSession();
    };
    */
  }, []);
```

**After** (10 lines):
```typescript
  useEffect(() => {
    const loadFromStorage = useSessionStore.getState().loadFromStorage;
    const startSession = useSessionStore.getState().startSession;

    loadFromStorage();
    startSession();
  }, []);
```

Removes: 2 preamble comments, 2 inline comments, 2 explanation comments, 2 stale TODOs, 14-line commented-out code block = **19 lines removed**.

### FilterComponents.tsx — Remove 5 lines

**Before** (lines 331-335):
```typescript
/**
 * Spice Level Selector Component (Currently disabled - not in daily filters)
 */
// Temporarily disabled - spice level not part of daily filters
// export const SpiceLevelFilter: React.FC = () => { return null; };
```

**After**: (empty — just a blank line between previous component and CalorieRangeFilter)

Removes: 3-line JSDoc + 1 explanation comment + 1 commented-out export = **5 lines removed**.

## Estimated LOC savings

~24 lines (19 from App.tsx + 5 from FilterComponents.tsx)

## Risk assessment

**Zero functional risk.**

- App.tsx: The `loadFromStorage()` and `startSession()` calls remain intact. Only comments and dead commented-out code are removed. The `/* */` block was explicitly disabled and is not executing. `endSession` has no live references.
- FilterComponents.tsx: `SpiceLevelFilter` is commented out and has zero imports anywhere. Even if uncommented, it returns null.

**Call sites checked:**
- `endSession`: only in commented-out block (App.tsx:88, 96) — 0 live references
- `SpiceLevelFilter`: 0 imports/references in entire codebase (only at FilterComponents.tsx:335, commented out)
- `loadFromStorage` / `startSession`: remain in the cleaned-up useEffect — unchanged
- `CalorieRangeFilter` at line 340: unaffected, separated by blank line

## Decision: apply
Safe to implement, no side effects. Pure removal of commented-out code, stale TODOs, and obvious-comment bloat.
