import { describe, it, expect } from "vitest";

describe("smoke test", () => {
  it("vitest is configured correctly", () => {
    expect(1 + 1).toBe(2);
  });

  it("resolves @/ path alias", async () => {
    const utils = await import("@/lib/utils");
    expect(utils.cn).toBeDefined();
  });
});
