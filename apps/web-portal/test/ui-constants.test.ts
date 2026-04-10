import { describe, it, expect } from "vitest";
import {
  INGREDIENT_FAMILY_COLORS,
  DIETARY_TAG_COLORS,
  DIETARY_TAG_COLOR_DEFAULT,
  STATUS_VARIANTS,
  SPICE_LEVEL_CONFIG,
} from "@/lib/ui-constants";

describe("INGREDIENT_FAMILY_COLORS", () => {
  it("contains at least 20 families", () => {
    expect(Object.keys(INGREDIENT_FAMILY_COLORS).length).toBeGreaterThanOrEqual(
      20
    );
  });

  it("every family has valid bg and text keys", () => {
    for (const [family, variant] of Object.entries(INGREDIENT_FAMILY_COLORS)) {
      expect(variant.bg, `${family}.bg`).toMatch(/^bg-/);
      expect(variant.text, `${family}.text`).toMatch(/^text-/);
    }
  });

  it("includes core families", () => {
    const expected = [
      "fish",
      "shellfish",
      "meat",
      "poultry",
      "dairy",
      "eggs",
      "vegetable",
      "fruit",
      "grain",
      "nut_seed",
      "spice_herb",
      "other",
    ];
    for (const key of expected) {
      expect(INGREDIENT_FAMILY_COLORS).toHaveProperty(key);
    }
  });
});

describe("DIETARY_TAG_COLORS", () => {
  it("has diet, religious, health, lifestyle entries", () => {
    expect(DIETARY_TAG_COLORS).toHaveProperty("diet");
    expect(DIETARY_TAG_COLORS).toHaveProperty("religious");
    expect(DIETARY_TAG_COLORS).toHaveProperty("health");
    expect(DIETARY_TAG_COLORS).toHaveProperty("lifestyle");
  });

  it("each value includes bg, text, and border classes", () => {
    for (const [key, value] of Object.entries(DIETARY_TAG_COLORS)) {
      expect(value, key).toMatch(/bg-/);
      expect(value, key).toMatch(/text-/);
      expect(value, key).toMatch(/border-/);
    }
  });

  it("default fallback includes bg, text, and border", () => {
    expect(DIETARY_TAG_COLOR_DEFAULT).toMatch(/bg-/);
    expect(DIETARY_TAG_COLOR_DEFAULT).toMatch(/text-/);
    expect(DIETARY_TAG_COLOR_DEFAULT).toMatch(/border-/);
  });
});

describe("STATUS_VARIANTS", () => {
  it("has active, suspended, pending", () => {
    expect(STATUS_VARIANTS).toHaveProperty("active");
    expect(STATUS_VARIANTS).toHaveProperty("suspended");
    expect(STATUS_VARIANTS).toHaveProperty("pending");
  });

  it("each variant has icon, bg, text, label", () => {
    for (const [key, config] of Object.entries(STATUS_VARIANTS)) {
      expect(config.icon, `${key}.icon`).toBeTruthy();
      expect(config.bg, `${key}.bg`).toMatch(/^bg-/);
      expect(config.text, `${key}.text`).toMatch(/^text-/);
      expect(config.label, `${key}.label`).toBeTruthy();
    }
  });
});

describe("SPICE_LEVEL_CONFIG", () => {
  it("has none, mild, hot levels", () => {
    const values = SPICE_LEVEL_CONFIG.map((l) => l.value);
    expect(values).toContain("none");
    expect(values).toContain("mild");
    expect(values).toContain("hot");
  });
});
