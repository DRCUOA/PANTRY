import { describe, expect, it } from "vitest";
import {
  getSwipeDirection,
  MAX_VERTICAL_DRIFT,
  SWIPE_THRESHOLD_PX,
} from "@/components/PlanSwipeContainer";

describe("getSwipeDirection", () => {
  it("navigates to previous week when horizontal delta passes positive threshold", () => {
    expect(
      getSwipeDirection({
        deltaX: SWIPE_THRESHOLD_PX + 1,
        deltaY: 0,
      }),
    ).toBe("prev");
  });

  it("navigates to next week when horizontal delta passes negative threshold", () => {
    expect(
      getSwipeDirection({
        deltaX: -(SWIPE_THRESHOLD_PX + 1),
        deltaY: 0,
      }),
    ).toBe("next");
  });

  it("does not navigate when horizontal movement is at threshold boundaries", () => {
    expect(
      getSwipeDirection({
        deltaX: SWIPE_THRESHOLD_PX,
        deltaY: 0,
      }),
    ).toBeNull();
    expect(
      getSwipeDirection({
        deltaX: -SWIPE_THRESHOLD_PX,
        deltaY: 0,
      }),
    ).toBeNull();
  });

  it("does not navigate when vertical drift exceeds max threshold", () => {
    expect(
      getSwipeDirection({
        deltaX: SWIPE_THRESHOLD_PX + 16,
        deltaY: MAX_VERTICAL_DRIFT + 1,
      }),
    ).toBeNull();
  });
});
