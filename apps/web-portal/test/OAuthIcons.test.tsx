import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { GoogleIcon, FacebookIcon } from "@/components/icons/OAuthIcons";

describe("OAuthIcons", () => {
  it("GoogleIcon renders an SVG without errors", () => {
    const { container } = render(<GoogleIcon className="h-4 w-4" />);
    const svg = container.querySelector("svg");
    expect(svg).toBeTruthy();
    expect(svg?.getAttribute("viewBox")).toBe("0 0 24 24");
    expect(svg?.querySelectorAll("path").length).toBeGreaterThanOrEqual(4);
  });

  it("FacebookIcon renders an SVG without errors", () => {
    const { container } = render(<FacebookIcon className="h-4 w-4" />);
    const svg = container.querySelector("svg");
    expect(svg).toBeTruthy();
    expect(svg?.getAttribute("viewBox")).toBe("0 0 24 24");
    expect(svg?.querySelectorAll("path").length).toBeGreaterThanOrEqual(1);
  });

  it("GoogleIcon passes through additional props", () => {
    const { container } = render(
      <GoogleIcon data-testid="google" className="mr-2 h-4 w-4" />
    );
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("data-testid")).toBe("google");
    expect(svg?.getAttribute("class")).toContain("mr-2");
  });

  it("FacebookIcon passes through additional props", () => {
    const { container } = render(
      <FacebookIcon data-testid="facebook" className="mr-2 h-4 w-4" />
    );
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("data-testid")).toBe("facebook");
  });
});
