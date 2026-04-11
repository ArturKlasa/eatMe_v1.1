import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDialog } from "@/hooks/useDialog";

describe("useDialog", () => {
  it("starts closed with null data", () => {
    const { result } = renderHook(() => useDialog<string>());
    expect(result.current.isOpen).toBe(false);
    expect(result.current.data).toBeNull();
  });

  it("accepts an initial value", () => {
    const { result } = renderHook(() => useDialog("initial"));
    expect(result.current.isOpen).toBe(false);
    expect(result.current.data).toBe("initial");
  });

  it("opens with provided data", () => {
    const { result } = renderHook(() => useDialog<string>());
    act(() => result.current.open("hello"));
    expect(result.current.isOpen).toBe(true);
    expect(result.current.data).toBe("hello");
  });

  it("opens without data and keeps previous data", () => {
    const { result } = renderHook(() => useDialog<string>());
    act(() => result.current.open("first"));
    act(() => result.current.close());
    // open again without providing data — should keep previous
    act(() => result.current.open());
    expect(result.current.isOpen).toBe(true);
    expect(result.current.data).toBe("first");
  });

  it("close sets isOpen to false but keeps data", () => {
    const { result } = renderHook(() => useDialog<string>());
    act(() => result.current.open("keep me"));
    act(() => result.current.close());
    expect(result.current.isOpen).toBe(false);
    expect(result.current.data).toBe("keep me");
  });

  it("reset sets isOpen to false and clears data", () => {
    const { result } = renderHook(() => useDialog<string>());
    act(() => result.current.open("clear me"));
    act(() => result.current.reset());
    expect(result.current.isOpen).toBe(false);
    expect(result.current.data).toBeNull();
  });

  it("works with object data types", () => {
    const { result } = renderHook(() => useDialog<{ id: number; name: string }>());
    act(() => result.current.open({ id: 1, name: "test" }));
    expect(result.current.data).toEqual({ id: 1, name: "test" });
  });
});
