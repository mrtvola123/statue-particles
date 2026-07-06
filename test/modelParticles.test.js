import * as THREE from "three";
import { describe, expect, it } from "vitest";
import {
  collectSurfaceTriangles,
  generateModelParticles,
  normalizePositions,
  sampleSurfacePositions
} from "../src/modelParticles.js";
import { createRng } from "../src/statue.js";

describe("collectSurfaceTriangles", () => {
  it("collects indexed mesh triangles with world transforms applied", () => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 4, 6), new THREE.MeshBasicMaterial());
    mesh.position.set(3, 5, 7);
    const root = new THREE.Group();
    root.add(mesh);

    const triangles = collectSurfaceTriangles(root);

    expect(triangles).toHaveLength(12);
    expect(triangles.some((triangle) => triangle.a.x > 2)).toBe(true);
    expect(triangles.every((triangle) => triangle.area > 0)).toBe(true);
  });
});

describe("sampleSurfacePositions", () => {
  it("samples larger triangles more often than smaller triangles", () => {
    const largeTriangle = {
      a: new THREE.Vector3(0, 0, 0),
      b: new THREE.Vector3(10, 0, 0),
      c: new THREE.Vector3(0, 10, 0),
      area: 50
    };
    const smallTriangle = {
      a: new THREE.Vector3(100, 0, 0),
      b: new THREE.Vector3(101, 0, 0),
      c: new THREE.Vector3(100, 1, 0),
      area: 0.5
    };
    const positions = sampleSurfacePositions([largeTriangle, smallTriangle], 1000, createRng(12));
    let largeSamples = 0;

    for (let index = 0; index < positions.length; index += 3) {
      if (positions[index] < 50) {
        largeSamples += 1;
      }
    }

    expect(largeSamples).toBeGreaterThan(970);
  });
});

describe("normalizePositions", () => {
  it("uses the deepest vertical axis and centers the point cloud", () => {
    const positions = new Float32Array([-1, 20, -10, 1, 22, 30]);
    const normalized = normalizePositions(positions, 8);

    expect(normalized.heightAxis).toBe("z");
    expect(normalized.bounds.min.y).toBeCloseTo(-4);
    expect(normalized.bounds.max.y).toBeCloseTo(4);
    expect(normalized.bounds.min.x).toBeCloseTo(-0.2);
    expect(normalized.bounds.max.x).toBeCloseTo(0.2);
  });
});

describe("generateModelParticles", () => {
  it("creates detailed buffers from a real mesh surface and scatter targets", () => {
    const statueStandIn = new THREE.Group();
    statueStandIn.add(new THREE.Mesh(new THREE.CylinderGeometry(0.6, 1.1, 4, 24, 4), new THREE.MeshBasicMaterial()));
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.2, 12), new THREE.MeshBasicMaterial());
    arm.rotation.z = -0.5;
    arm.position.set(0.75, 1.3, 0);
    statueStandIn.add(arm);

    const particles = generateModelParticles(statueStandIn, { count: 1200, seed: 1886, height: 6.4 });

    expect(particles.source).toBe("mesh");
    expect(particles.triangleCount).toBeGreaterThan(100);
    expect(particles.targetPositions).toHaveLength(3600);
    expect(particles.colors).toHaveLength(3600);
    expect(particles.sizes).toHaveLength(1200);
    expect(particles.bounds.max.y - particles.bounds.min.y).toBeCloseTo(6.4, 1);
    expect(distanceBetweenFirstPair(particles.targetPositions, particles.scatterPositions)).toBeGreaterThan(3);
  });
});

function distanceBetweenFirstPair(targetPositions, scatterPositions) {
  return Math.hypot(
    scatterPositions[0] - targetPositions[0],
    scatterPositions[1] - targetPositions[1],
    scatterPositions[2] - targetPositions[2]
  );
}
