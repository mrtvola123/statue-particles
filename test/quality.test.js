import { describe, expect, it } from "vitest";
import {
  QUALITY_COUNTS,
  QUALITY_STORAGE_KEY,
  createDeviceProfile,
  normalizeQualityMode,
  resolveParticleCount
} from "../src/quality.js";

describe("normalizeQualityMode", () => {
  it("keeps supported modes and falls back to auto for unknown values", () => {
    expect(normalizeQualityMode("performance")).toBe("performance");
    expect(normalizeQualityMode("high")).toBe("high");
    expect(normalizeQualityMode("ultra")).toBe("ultra");
    expect(normalizeQualityMode("unknown")).toBe("auto");
    expect(normalizeQualityMode(null)).toBe("auto");
  });
});

describe("resolveParticleCount", () => {
  it("uses fixed counts for explicit quality modes", () => {
    expect(resolveParticleCount("performance")).toBe(QUALITY_COUNTS.performance);
    expect(resolveParticleCount("high")).toBe(QUALITY_COUNTS.high);
    expect(resolveParticleCount("ultra")).toBe(QUALITY_COUNTS.ultra);
  });

  it("keeps auto lighter on phones and constrained devices", () => {
    expect(resolveParticleCount("auto", { width: 390, pixelRatio: 3, cores: 8, memory: 8 })).toBe(
      QUALITY_COUNTS.performance
    );
    expect(resolveParticleCount("auto", { width: 1024, pixelRatio: 1, cores: 4, memory: 4 })).toBe(
      QUALITY_COUNTS.performance
    );
  });

  it("raises auto on strong desktop profiles and otherwise stays balanced", () => {
    expect(resolveParticleCount("auto", { width: 1440, pixelRatio: 1.5, cores: 12, memory: 16 })).toBe(
      QUALITY_COUNTS.high
    );
    expect(resolveParticleCount("auto", { width: 1180, pixelRatio: 2, cores: 8, memory: 8 })).toBe(
      QUALITY_COUNTS.balanced
    );
  });
});

describe("createDeviceProfile", () => {
  it("reads browser hints without requiring every hint to exist", () => {
    expect(
      createDeviceProfile(
        { innerWidth: 1366, devicePixelRatio: 1.25 },
        { hardwareConcurrency: 10, deviceMemory: 16 }
      )
    ).toEqual({
      width: 1366,
      pixelRatio: 1.25,
      cores: 10,
      memory: 16
    });
    expect(QUALITY_STORAGE_KEY).toBe("liberty-particle-quality");
  });
});
