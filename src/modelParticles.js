import * as THREE from "three";
import { createRng } from "./statue.js";

const COPPER = [0.24, 0.78, 0.68];
const COPPER_SHADOW = [0.05, 0.25, 0.27];
const COPPER_HIGHLIGHT = [0.5, 0.94, 0.82];
const FLAME = [1.0, 0.48, 0.12];
const STONE = [0.4, 0.49, 0.48];

export function collectSurfaceTriangles(root) {
  const triangles = [];

  root.updateWorldMatrix(true, true);
  root.traverse((object) => {
    if (!object.isMesh || !object.geometry?.attributes?.position) {
      return;
    }

    const geometry = object.geometry;
    const position = geometry.attributes.position;
    const index = geometry.index;
    const materialColor = getMaterialColor(object.material);
    const triangleCount = index ? index.count / 3 : position.count / 3;

    for (let triangleIndex = 0; triangleIndex < triangleCount; triangleIndex += 1) {
      const indices = index
        ? [index.getX(triangleIndex * 3), index.getX(triangleIndex * 3 + 1), index.getX(triangleIndex * 3 + 2)]
        : [triangleIndex * 3, triangleIndex * 3 + 1, triangleIndex * 3 + 2];
      const a = readWorldVertex(position, indices[0], object.matrixWorld);
      const b = readWorldVertex(position, indices[1], object.matrixWorld);
      const c = readWorldVertex(position, indices[2], object.matrixWorld);
      const area = calculateTriangleArea(a, b, c);

      if (area > 0.000001) {
        triangles.push({ a, b, c, area, materialColor });
      }
    }
  });

  return triangles;
}

export function generateModelParticles(root, { count = 42000, seed = 1886, height = 6.4, scatterRadius = 8.6 } = {}) {
  const triangles = collectSurfaceTriangles(root);

  if (triangles.length === 0) {
    throw new Error("No mesh surface found in Statue of Liberty model.");
  }

  const rng = createRng(seed);
  const targetPositions = sampleSurfacePositions(triangles, count, rng);
  const normalization = normalizePositions(targetPositions, height);
  const scatterPositions = createScatterPositions(normalization.positions, scatterRadius, rng);
  const colors = createModelColors(normalization.positions, normalization.bounds, rng);
  const sizes = createParticleSizes(count, rng);

  return {
    count,
    targetPositions: normalization.positions,
    scatterPositions,
    colors,
    sizes,
    bounds: normalization.bounds,
    source: "mesh",
    triangleCount: triangles.length
  };
}

export function sampleSurfacePositions(triangles, count, rng = createRng(1886)) {
  const cumulativeAreas = new Float64Array(triangles.length);
  let totalArea = 0;

  for (let index = 0; index < triangles.length; index += 1) {
    totalArea += triangles[index].area;
    cumulativeAreas[index] = totalArea;
  }

  const positions = new Float32Array(count * 3);

  for (let index = 0; index < count; index += 1) {
    const triangle = pickTriangle(triangles, cumulativeAreas, rng() * totalArea);
    const point = sampleTriangle(triangle.a, triangle.b, triangle.c, rng);
    const offset = index * 3;

    positions[offset] = point.x;
    positions[offset + 1] = point.y;
    positions[offset + 2] = point.z;
  }

  return positions;
}

export function normalizePositions(positions, targetHeight = 6.4) {
  const sourceBounds = calculateBounds(positions);
  const size = {
    x: sourceBounds.max.x - sourceBounds.min.x,
    y: sourceBounds.max.y - sourceBounds.min.y,
    z: sourceBounds.max.z - sourceBounds.min.z
  };
  const heightAxis = size.z > size.y * 1.25 ? "z" : "y";
  const scale = targetHeight / Math.max(size[heightAxis], 0.000001);
  const normalized = new Float32Array(positions.length);
  const centerX = (sourceBounds.min.x + sourceBounds.max.x) / 2;
  const centerY = (sourceBounds.min[heightAxis] + sourceBounds.max[heightAxis]) / 2;
  const centerDepthAxis = heightAxis === "z" ? "y" : "z";
  const centerZ = (sourceBounds.min[centerDepthAxis] + sourceBounds.max[centerDepthAxis]) / 2;

  for (let index = 0; index < positions.length; index += 3) {
    const sourceX = positions[index];
    const sourceY = positions[index + 1];
    const sourceZ = positions[index + 2];
    const uprightY = heightAxis === "z" ? sourceZ : sourceY;
    const depth = heightAxis === "z" ? sourceY : sourceZ;

    normalized[index] = (sourceX - centerX) * scale;
    normalized[index + 1] = (uprightY - centerY) * scale;
    normalized[index + 2] = (depth - centerZ) * scale;
  }

  return {
    positions: normalized,
    bounds: calculateBounds(normalized),
    heightAxis,
    scale
  };
}

export function calculateBounds(positions) {
  const bounds = {
    min: { x: Infinity, y: Infinity, z: Infinity },
    max: { x: -Infinity, y: -Infinity, z: -Infinity }
  };

  for (let index = 0; index < positions.length; index += 3) {
    bounds.min.x = Math.min(bounds.min.x, positions[index]);
    bounds.min.y = Math.min(bounds.min.y, positions[index + 1]);
    bounds.min.z = Math.min(bounds.min.z, positions[index + 2]);
    bounds.max.x = Math.max(bounds.max.x, positions[index]);
    bounds.max.y = Math.max(bounds.max.y, positions[index + 1]);
    bounds.max.z = Math.max(bounds.max.z, positions[index + 2]);
  }

  return bounds;
}

function createScatterPositions(targetPositions, scatterRadius, rng) {
  const scatterPositions = new Float32Array(targetPositions.length);

  for (let index = 0; index < targetPositions.length; index += 3) {
    const x = targetPositions[index];
    const y = targetPositions[index + 1];
    const z = targetPositions[index + 2];
    const theta = rng() * Math.PI * 2;
    const vertical = -0.9 + rng() * 1.8;
    const planar = Math.sqrt(1 - vertical * vertical);
    const distance = scatterRadius * (0.42 + rng() * 0.72);

    scatterPositions[index] = x + Math.cos(theta) * planar * distance;
    scatterPositions[index + 1] = y + vertical * distance + (rng() - 0.5) * 2.2;
    scatterPositions[index + 2] = z + Math.sin(theta) * planar * distance;
  }

  return scatterPositions;
}

function createModelColors(positions, bounds, rng) {
  const colors = new Float32Array(positions.length);
  const height = bounds.max.y - bounds.min.y;

  for (let index = 0; index < positions.length; index += 3) {
    const x = positions[index];
    const y = positions[index + 1];
    const normalizedY = (y - bounds.min.y) / height;
    const isPedestal = normalizedY < 0.18;
    const isFlame = normalizedY > 0.84 && x > 0.25;
    const color = isFlame
      ? mix(FLAME, COPPER_HIGHLIGHT, rng() * 0.28)
      : isPedestal
        ? mix(STONE, COPPER_SHADOW, rng() * 0.26)
        : mix(COPPER_SHADOW, COPPER_HIGHLIGHT, 0.24 + normalizedY * 0.25 + rng() * 0.2);

    colors[index] = color[0];
    colors[index + 1] = color[1];
    colors[index + 2] = color[2];
  }

  return colors;
}

function createParticleSizes(count, rng) {
  const sizes = new Float32Array(count);

  for (let index = 0; index < count; index += 1) {
    sizes[index] = 0.45 + rng() * 0.9;
  }

  return sizes;
}

function pickTriangle(triangles, cumulativeAreas, areaPick) {
  let low = 0;
  let high = cumulativeAreas.length - 1;

  while (low < high) {
    const middle = Math.floor((low + high) / 2);

    if (areaPick <= cumulativeAreas[middle]) {
      high = middle;
    } else {
      low = middle + 1;
    }
  }

  return triangles[low];
}

function sampleTriangle(a, b, c, rng) {
  const r1 = Math.sqrt(rng());
  const r2 = rng();
  const aWeight = 1 - r1;
  const bWeight = r1 * (1 - r2);
  const cWeight = r1 * r2;

  return {
    x: a.x * aWeight + b.x * bWeight + c.x * cWeight,
    y: a.y * aWeight + b.y * bWeight + c.y * cWeight,
    z: a.z * aWeight + b.z * bWeight + c.z * cWeight
  };
}

function calculateTriangleArea(a, b, c) {
  const ab = new THREE.Vector3().subVectors(b, a);
  const ac = new THREE.Vector3().subVectors(c, a);
  return new THREE.Vector3().crossVectors(ab, ac).length() * 0.5;
}

function readWorldVertex(position, index, matrixWorld) {
  return new THREE.Vector3(position.getX(index), position.getY(index), position.getZ(index)).applyMatrix4(matrixWorld);
}

function getMaterialColor(material) {
  const source = Array.isArray(material) ? material[0] : material;

  if (!source?.color) {
    return COPPER;
  }

  return [source.color.r, source.color.g, source.color.b];
}

function mix(a, b, amount) {
  const t = Math.max(0, Math.min(1, amount));
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t
  ];
}
