import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { useFilters } from "@/hooks/useFilters";
import type { FilterEntry } from "@/hooks/useFilters";

interface Item {
  name: string;
  status: string;
}

const items: Item[] = [
  { name: "Pizza Palace", status: "active" },
  { name: "Burger Barn", status: "inactive" },
  { name: "Pasta Place", status: "active" },
  { name: "Sushi Spot", status: "pending" },
];

describe("useFilters", () => {
  it("returns all items when no filters are active (empty values)", () => {
    const filters: FilterEntry<Item>[] = [
      { value: "", fn: (item, v) => item.name.includes(v) },
    ];
    const { result } = renderHook(() => useFilters(items, filters));
    expect(result.current).toHaveLength(4);
  });

  it("applies a single active filter", () => {
    const filters: FilterEntry<Item>[] = [
      {
        value: "pizza",
        fn: (item, v) => item.name.toLowerCase().includes(v.toLowerCase()),
      },
    ];
    const { result } = renderHook(() => useFilters(items, filters));
    expect(result.current).toHaveLength(1);
    expect(result.current[0].name).toBe("Pizza Palace");
  });

  it("applies multiple active filters with AND logic", () => {
    const filters: FilterEntry<Item>[] = [
      {
        value: "a",
        fn: (item, v) => item.name.toLowerCase().includes(v.toLowerCase()),
      },
      { value: "active", fn: (item, v) => item.status === v },
    ];
    const { result } = renderHook(() => useFilters(items, filters));
    // Items with "a" in name AND status === "active"
    expect(result.current).toHaveLength(2);
    expect(result.current.map((i) => i.name)).toContain("Pizza Palace");
    expect(result.current.map((i) => i.name)).toContain("Pasta Place");
  });

  it("returns empty array when no items match", () => {
    const filters: FilterEntry<Item>[] = [
      { value: "nonexistent", fn: (item, v) => item.name.includes(v) },
    ];
    const { result } = renderHook(() => useFilters(items, filters));
    expect(result.current).toHaveLength(0);
  });

  it("skips inactive filters (empty string value) — all items pass", () => {
    const filters: FilterEntry<Item>[] = [
      { value: "", fn: (item, v) => item.name.includes(v) },
      { value: "", fn: (item, v) => item.status === v },
    ];
    const { result } = renderHook(() => useFilters(items, filters));
    expect(result.current).toHaveLength(4);
  });

  it("handles case insensitivity in consumer fn", () => {
    const filters: FilterEntry<Item>[] = [
      {
        value: "PIZZA",
        fn: (item, v) => item.name.toLowerCase().includes(v.toLowerCase()),
      },
    ];
    const { result } = renderHook(() => useFilters(items, filters));
    expect(result.current).toHaveLength(1);
    expect(result.current[0].name).toBe("Pizza Palace");
  });

  it("works with empty items array", () => {
    const filters: FilterEntry<Item>[] = [
      { value: "active", fn: (item, v) => item.status === v },
    ];
    const { result } = renderHook(() => useFilters([], filters));
    expect(result.current).toHaveLength(0);
  });

  it("returns all items when filters array is empty", () => {
    const { result } = renderHook(() => useFilters(items, []));
    expect(result.current).toHaveLength(4);
  });
});
