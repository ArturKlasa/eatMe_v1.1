import { describe, it, expect } from 'vitest';
import { createStore } from 'zustand/vanilla';
import { createSavedMetaSlice, SavedMetaSlice } from '../savedMetaSlice';

function makeStore() {
  return createStore<SavedMetaSlice>()((...a) => createSavedMetaSlice(...a));
}

describe('savedMetaSlice', () => {
  it('initialises with null lastSavedAt', () => {
    const store = makeStore();
    expect(store.getState().lastSavedAt).toBeNull();
  });

  it('initialises with empty jobId and zero count', () => {
    const store = makeStore();
    expect(store.getState().lastSavedJobId).toBe('');
    expect(store.getState().lastSavedCount).toBe(0);
  });

  it('setLastSaved records a Date for lastSavedAt', () => {
    const store = makeStore();
    store.getState().setLastSaved('job-abc', 42);
    expect(store.getState().lastSavedAt).toBeInstanceOf(Date);
  });

  it('setLastSaved stores the jobId', () => {
    const store = makeStore();
    store.getState().setLastSaved('job-abc', 42);
    expect(store.getState().lastSavedJobId).toBe('job-abc');
  });

  it('setLastSaved stores the count', () => {
    const store = makeStore();
    store.getState().setLastSaved('job-abc', 42);
    expect(store.getState().lastSavedCount).toBe(42);
  });

  it('clearLastSaved resets lastSavedAt to null', () => {
    const store = makeStore();
    store.getState().setLastSaved('job-abc', 42);
    store.getState().clearLastSaved();
    expect(store.getState().lastSavedAt).toBeNull();
  });

  it('clearLastSaved resets jobId to empty string', () => {
    const store = makeStore();
    store.getState().setLastSaved('job-abc', 42);
    store.getState().clearLastSaved();
    expect(store.getState().lastSavedJobId).toBe('');
  });

  it('clearLastSaved resets count to zero', () => {
    const store = makeStore();
    store.getState().setLastSaved('job-abc', 42);
    store.getState().clearLastSaved();
    expect(store.getState().lastSavedCount).toBe(0);
  });

  it('setLastSaved can be called multiple times and overwrites', () => {
    const store = makeStore();
    store.getState().setLastSaved('job-1', 10);
    store.getState().setLastSaved('job-2', 99);
    expect(store.getState().lastSavedJobId).toBe('job-2');
    expect(store.getState().lastSavedCount).toBe(99);
  });
});
