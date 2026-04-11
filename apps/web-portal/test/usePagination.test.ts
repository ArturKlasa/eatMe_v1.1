import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { usePagination } from "@/hooks/usePagination";

const makeItems = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

describe("usePagination", () => {
  it("returns first pageSize items on page 1", () => {
    const items = makeItems(50);
    const { result } = renderHook(() => usePagination(items, 25));
    expect(result.current.page).toBe(1);
    expect(result.current.paginatedItems).toEqual(makeItems(25));
  });

  it("returns remainder on last page", () => {
    const items = makeItems(30);
    const { result } = renderHook(() => usePagination(items, 25));
    act(() => result.current.setPage(2));
    expect(result.current.paginatedItems).toEqual([26, 27, 28, 29, 30]);
  });

  it("calculates totalPages correctly", () => {
    const { result } = renderHook(() => usePagination(makeItems(51), 25));
    expect(result.current.totalPages).toBe(3);
  });

  it("totalPages is at least 1 for empty array", () => {
    const { result } = renderHook(() => usePagination([], 25));
    expect(result.current.totalPages).toBe(1);
  });

  it("setPage clamps below 1", () => {
    const { result } = renderHook(() => usePagination(makeItems(50), 25));
    act(() => result.current.setPage(0));
    expect(result.current.page).toBe(1);
  });

  it("setPage clamps above totalPages", () => {
    const { result } = renderHook(() => usePagination(makeItems(50), 25));
    act(() => result.current.setPage(99));
    expect(result.current.page).toBe(2);
  });

  it("hasNext is false on last page", () => {
    const { result } = renderHook(() => usePagination(makeItems(25), 25));
    expect(result.current.hasNext).toBe(false);
  });

  it("hasNext is true when more pages exist", () => {
    const { result } = renderHook(() => usePagination(makeItems(26), 25));
    expect(result.current.hasNext).toBe(true);
  });

  it("hasPrev is false on page 1", () => {
    const { result } = renderHook(() => usePagination(makeItems(50), 25));
    expect(result.current.hasPrev).toBe(false);
  });

  it("hasPrev is true on page 2+", () => {
    const { result } = renderHook(() => usePagination(makeItems(50), 25));
    act(() => result.current.setPage(2));
    expect(result.current.hasPrev).toBe(true);
  });

  it("resets to page 1 when items.length changes", () => {
    const items = makeItems(50);
    const { result, rerender } = renderHook(
      ({ list }) => usePagination(list, 25),
      { initialProps: { list: items } }
    );
    act(() => result.current.setPage(2));
    expect(result.current.page).toBe(2);

    // Simulate items changing (different length)
    act(() => {
      rerender({ list: makeItems(30) });
    });
    expect(result.current.page).toBe(1);
  });

  it("uses default pageSize of 25", () => {
    const items = makeItems(30);
    const { result } = renderHook(() => usePagination(items));
    expect(result.current.paginatedItems).toHaveLength(25);
    expect(result.current.totalPages).toBe(2);
  });
});
