import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { StockStateBadge } from "@/components/StockStateBadge";

describe("StockStateBadge", () => {
  it("renders out-of-stock badge with icon and semantic text", () => {
    const html = renderToStaticMarkup(<StockStateBadge state="out" />);
    expect(html).toContain("stock-state-badge--out");
    expect(html).toContain("Out of stock");
    expect(html).toContain("⛔");
  });

  it("renders low-stock badge with icon and semantic text", () => {
    const html = renderToStaticMarkup(<StockStateBadge state="low" />);
    expect(html).toContain("stock-state-badge--low");
    expect(html).toContain("Low stock");
    expect(html).toContain("⚠");
  });

  it("renders handled badge with icon and semantic text", () => {
    const html = renderToStaticMarkup(<StockStateBadge state="handled" />);
    expect(html).toContain("stock-state-badge--handled");
    expect(html).toContain("Handled");
    expect(html).toContain("✓");
  });

  it("renders on-shopping-list badge with icon and semantic text", () => {
    const html = renderToStaticMarkup(<StockStateBadge state="on_list" />);
    expect(html).toContain("stock-state-badge--on_list");
    expect(html).toContain("On shopping list");
    expect(html).toContain("🛒");
  });
});
