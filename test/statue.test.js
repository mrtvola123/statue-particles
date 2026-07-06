import { describe, expect, it } from "vitest";
import { generateStatueParticles, interpolatePositions } from "../src/statue.js";

describe("generateStatueParticles", () => {
  it("creates matching buffers for the requested particle count", () => {
    const particles = generateStatueParticles({ count: 1200, seed: 1886 });

    expect(particles.count).toBe(1200);
    expect(particles.targetPositions).toHaveLength(3600);
    expect(particles.scatterPositions).toHaveLength(3600);
    expect(particles.colors).toHaveLength(3600);
    expect(particles.sizes).toHaveLength(1200);
  });

  it("samples every recognizable statue component", () => {
    const particles = generateStatueParticles({ count: 5000, seed: 1886 });
    const requiredComponents = ["pedestal", "robe", "folds", "head", "crown", "torchArm", "tablet", "flame"];

    for (const component of requiredComponents) {
      expect(particles.componentCounts[component]).toBeGreaterThan(0);
    }
  });

  it("keeps assembled target positions inside a statue-like vertical silhouette", () => {
    const particles = generateStatueParticles({ count: 5000, seed: 1886 });

    expect(particles.bounds.min.y).toBeGreaterThanOrEqual(-3.51);
    expect(particles.bounds.max.y).toBeGreaterThan(2.9);
    expect(particles.bounds.max.x).toBeGreaterThan(1.2);
    expect(particles.bounds.min.x).toBeLessThan(-1.0);
  });

  it("places scattered particles far enough from their assembled targets", () => {
    const particles = generateStatueParticles({ count: 1000, seed: 1886 });
    let farAwayCount = 0;

    for (let index = 0; index < particles.targetPositions.length; index += 3) {
      const dx = particles.scatterPositions[index] - particles.targetPositions[index];
      const dy = particles.scatterPositions[index + 1] - particles.targetPositions[index + 1];
      const dz = particles.scatterPositions[index + 2] - particles.targetPositions[index + 2];
      const distance = Math.hypot(dx, dy, dz);

      if (distance > 2.5) {
        farAwayCount += 1;
      }
    }

    expect(farAwayCount / particles.count).toBeGreaterThan(0.9);
  });

  it("is deterministic for the same seed", () => {
    const first = generateStatueParticles({ count: 32, seed: 7 });
    const second = generateStatueParticles({ count: 32, seed: 7 });

    expect(Array.from(first.targetPositions)).toEqual(Array.from(second.targetPositions));
    expect(Array.from(first.scatterPositions)).toEqual(Array.from(second.scatterPositions));
  });
});

describe("interpolatePositions", () => {
  it("returns target positions at zero progress and scatter positions at full progress", () => {
    const from = new Float32Array([0, 2, 4]);
    const to = new Float32Array([10, 12, 14]);

    expect(Array.from(interpolatePositions(from, to, 0))).toEqual([0, 2, 4]);
    expect(Array.from(interpolatePositions(from, to, 1))).toEqual([10, 12, 14]);
  });

  it("clamps progress outside the animation range", () => {
    const from = new Float32Array([0, 0, 0]);
    const to = new Float32Array([4, 8, 12]);

    expect(Array.from(interpolatePositions(from, to, -1))).toEqual([0, 0, 0]);
    expect(Array.from(interpolatePositions(from, to, 2))).toEqual([4, 8, 12]);
  });
});
