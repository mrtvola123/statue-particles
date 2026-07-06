import { describe, expect, it } from "vitest";
import { createFireworkSchedule, getAmerica250IntroFrame } from "../src/celebration.js";

describe("getAmerica250IntroFrame", () => {
  it("steps through the America 250 intro labels", () => {
    expect(getAmerica250IntroFrame(0.5).label).toBe("1776");
    expect(getAmerica250IntroFrame(2.5).label).toBe("2026");
    expect(getAmerica250IntroFrame(5).label).toBe("AMERICA 250");
  });

  it("returns a complete empty frame after the intro", () => {
    const frame = getAmerica250IntroFrame(9);

    expect(frame.label).toBe("");
    expect(frame.opacity).toBe(0);
    expect(frame.isComplete).toBe(true);
  });

  it("fades each label in and out", () => {
    expect(getAmerica250IntroFrame(0).opacity).toBe(0);
    expect(getAmerica250IntroFrame(1).opacity).toBeGreaterThan(0.95);
    expect(getAmerica250IntroFrame(2.05).opacity).toBeLessThan(0.25);
  });
});

describe("createFireworkSchedule", () => {
  it("creates deterministic firework events inside the scene", () => {
    const events = createFireworkSchedule({ duration: 4, interval: 1, startAt: 1 });

    expect(events).toHaveLength(4);
    expect(events[0].time).toBe(1);
    expect(events.every((event) => event.y >= 0.65 && event.y <= 2.9)).toBe(true);
    expect(events.every((event) => event.z < 0.35)).toBe(true);
  });
});
