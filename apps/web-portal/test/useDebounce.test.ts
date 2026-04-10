import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDebounce } from "@/lib/hooks/useDebounce";

describe("useDebounce", () => {
  it("returns the initial value immediately", () => {
    const { result } = renderHook(() => useDebounce("hello", 300));
    expect(result.current).toBe("hello");
  });

  it("does not update the value before the delay", () => {
    vi.useFakeTimers();

    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 300),
      { initialProps: { value: "a" } }
    );

    rerender({ value: "b" });
    vi.advanceTimersByTime(100);
    expect(result.current).toBe("a");

    vi.useRealTimers();
  });

  it("updates the value after the delay", () => {
    vi.useFakeTimers();

    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 300),
      { initialProps: { value: "a" } }
    );

    rerender({ value: "b" });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(result.current).toBe("b");

    vi.useRealTimers();
  });

  it("resets the timer on rapid changes", () => {
    vi.useFakeTimers();

    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 300),
      { initialProps: { value: "a" } }
    );

    rerender({ value: "b" });
    vi.advanceTimersByTime(200);
    rerender({ value: "c" });
    vi.advanceTimersByTime(200);
    // 400ms total but only 200ms since last change
    expect(result.current).toBe("a");

    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(result.current).toBe("c");

    vi.useRealTimers();
  });

  it("uses 300ms as default delay", () => {
    vi.useFakeTimers();

    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value),
      { initialProps: { value: 1 } }
    );

    rerender({ value: 2 });
    vi.advanceTimersByTime(299);
    expect(result.current).toBe(1);

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe(2);

    vi.useRealTimers();
  });
});
