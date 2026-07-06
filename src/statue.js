const COMPONENTS = [
  { name: "pedestal", weight: 0.11 },
  { name: "robe", weight: 0.4 },
  { name: "folds", weight: 0.12 },
  { name: "head", weight: 0.06 },
  { name: "crown", weight: 0.08 },
  { name: "torchArm", weight: 0.11 },
  { name: "tablet", weight: 0.08 },
  { name: "flame", weight: 0.04 }
];

const PALETTE = {
  oxidizedCopper: [0.34, 0.84, 0.73],
  shadowCopper: [0.12, 0.44, 0.43],
  highlight: [0.73, 1.0, 0.88],
  stone: [0.62, 0.7, 0.66],
  flameCore: [1.0, 0.82, 0.32],
  flameEdge: [1.0, 0.34, 0.13]
};

export function createRng(seed = 12345) {
  let state = seed >>> 0;

  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

export function generateStatueParticles({ count = 16000, seed = 12345, scatterRadius = 7.5 } = {}) {
  const rng = createRng(seed);
  const targetPositions = new Float32Array(count * 3);
  const scatterPositions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const componentCounts = Object.fromEntries(COMPONENTS.map((component) => [component.name, 0]));

  for (let index = 0; index < count; index += 1) {
    const component = selectComponent(rng);
    const point = sampleComponent(component.name, rng);
    const scatter = createScatterPoint(point, scatterRadius, rng);
    const color = colorForComponent(component.name, point, rng);
    const offset = index * 3;

    targetPositions[offset] = point.x;
    targetPositions[offset + 1] = point.y;
    targetPositions[offset + 2] = point.z;
    scatterPositions[offset] = scatter.x;
    scatterPositions[offset + 1] = scatter.y;
    scatterPositions[offset + 2] = scatter.z;
    colors[offset] = color[0];
    colors[offset + 1] = color[1];
    colors[offset + 2] = color[2];
    sizes[index] = component.name === "flame" ? randomRange(3.2, 5.2, rng) : randomRange(1.35, 2.8, rng);
    componentCounts[component.name] += 1;
  }

  return {
    count,
    targetPositions,
    scatterPositions,
    colors,
    sizes,
    componentCounts,
    bounds: calculateBounds(targetPositions)
  };
}

export function interpolatePositions(fromPositions, toPositions, progress) {
  const clampedProgress = Math.max(0, Math.min(1, progress));
  const positions = new Float32Array(fromPositions.length);

  for (let index = 0; index < fromPositions.length; index += 1) {
    positions[index] = fromPositions[index] + (toPositions[index] - fromPositions[index]) * clampedProgress;
  }

  return positions;
}

function selectComponent(rng) {
  const totalWeight = COMPONENTS.reduce((total, component) => total + component.weight, 0);
  const pick = rng() * totalWeight;
  let cursor = 0;

  for (const component of COMPONENTS) {
    cursor += component.weight;
    if (pick <= cursor) {
      return component;
    }
  }

  return COMPONENTS[COMPONENTS.length - 1];
}

function sampleComponent(name, rng) {
  if (name === "pedestal") {
    return sampleBox({ x: 0, y: -3.0, z: 0 }, { x: 2.35, y: 1.0, z: 1.28 }, rng);
  }

  if (name === "robe") {
    const y = randomRange(-2.35, 1.35, rng);
    const normalized = (y + 2.35) / 3.7;
    const baseRadius = 0.92 - normalized * 0.46;
    const angle = rng() * Math.PI * 2;
    const ripple = 1 + Math.sin(angle * 6 + y * 2.2) * 0.08;
    const radius = baseRadius * ripple * Math.sqrt(rng());

    return {
      x: Math.cos(angle) * radius * 0.78,
      y,
      z: Math.sin(angle) * radius * 0.52
    };
  }

  if (name === "folds") {
    const y = randomRange(-2.2, 1.1, rng);
    const fold = Math.floor(rng() * 9);
    const angle = (fold / 9) * Math.PI * 2 + randomRange(-0.05, 0.05, rng);
    const normalized = (y + 2.2) / 3.3;
    const radius = 0.88 - normalized * 0.38;

    return {
      x: Math.cos(angle) * radius * 0.82,
      y,
      z: Math.sin(angle) * radius * 0.58
    };
  }

  if (name === "head") {
    return sampleSphere({ x: 0.02, y: 1.83, z: 0 }, { x: 0.28, y: 0.34, z: 0.27 }, rng);
  }

  if (name === "crown") {
    if (rng() < 0.45) {
      return sampleRing({ x: 0.02, y: 2.18, z: 0 }, 0.34, 0.08, rng);
    }

    const ray = Math.floor(rng() * 7);
    const angle = (ray / 7) * Math.PI * 2 + Math.PI / 2;
    const reach = randomRange(0.18, 0.58, rng);
    const tiltY = Math.sin(reach * Math.PI) * 0.26;

    return {
      x: 0.02 + Math.cos(angle) * reach * 0.72 + randomRange(-0.025, 0.025, rng),
      y: 2.18 + reach * 0.5 + tiltY,
      z: Math.sin(angle) * reach * 0.5 + randomRange(-0.018, 0.018, rng)
    };
  }

  if (name === "torchArm") {
    const shoulder = { x: 0.34, y: 0.98, z: 0.02 };
    const wrist = { x: 1.15, y: 2.62, z: 0.01 };
    const point = sampleCapsule(shoulder, wrist, 0.075, rng);

    if (rng() > 0.78) {
      return sampleCapsule({ x: 1.15, y: 2.5, z: 0.01 }, { x: 1.27, y: 2.85, z: 0.01 }, 0.09, rng);
    }

    return point;
  }

  if (name === "tablet") {
    const y = randomRange(-0.88, 0.7, rng);
    const x = -0.58 + (y + 0.88) * -0.1 + randomRange(-0.13, 0.13, rng);

    return {
      x,
      y,
      z: -0.34 + randomRange(-0.035, 0.035, rng)
    };
  }

  return sampleSphere({ x: 1.3, y: 3.02, z: 0.02 }, { x: 0.16, y: 0.34, z: 0.16 }, rng);
}

function sampleBox(center, size, rng) {
  const face = Math.floor(rng() * 6);
  const x = randomRange(-size.x / 2, size.x / 2, rng);
  const y = randomRange(-size.y / 2, size.y / 2, rng);
  const z = randomRange(-size.z / 2, size.z / 2, rng);

  if (face === 0) return { x: center.x - size.x / 2, y: center.y + y, z: center.z + z };
  if (face === 1) return { x: center.x + size.x / 2, y: center.y + y, z: center.z + z };
  if (face === 2) return { x: center.x + x, y: center.y - size.y / 2, z: center.z + z };
  if (face === 3) return { x: center.x + x, y: center.y + size.y / 2, z: center.z + z };
  if (face === 4) return { x: center.x + x, y: center.y + y, z: center.z - size.z / 2 };

  return { x: center.x + x, y: center.y + y, z: center.z + size.z / 2 };
}

function sampleSphere(center, scale, rng) {
  const theta = rng() * Math.PI * 2;
  const phi = Math.acos(2 * rng() - 1);
  const radius = Math.cbrt(rng());

  return {
    x: center.x + Math.sin(phi) * Math.cos(theta) * scale.x * radius,
    y: center.y + Math.cos(phi) * scale.y * radius,
    z: center.z + Math.sin(phi) * Math.sin(theta) * scale.z * radius
  };
}

function sampleRing(center, radius, thickness, rng) {
  const angle = rng() * Math.PI * 2;
  const band = randomRange(-thickness, thickness, rng);

  return {
    x: center.x + Math.cos(angle) * (radius + band) * 0.9,
    y: center.y + randomRange(-0.04, 0.05, rng),
    z: center.z + Math.sin(angle) * (radius + band) * 0.55
  };
}

function sampleCapsule(start, end, radius, rng) {
  const t = rng();
  const angle = rng() * Math.PI * 2;
  const localRadius = Math.sqrt(rng()) * radius;
  const point = {
    x: start.x + (end.x - start.x) * t,
    y: start.y + (end.y - start.y) * t,
    z: start.z + (end.z - start.z) * t
  };

  return {
    x: point.x + Math.cos(angle) * localRadius,
    y: point.y + Math.sin(angle) * localRadius * 0.35,
    z: point.z + Math.sin(angle) * localRadius
  };
}

function createScatterPoint(point, scatterRadius, rng) {
  const theta = rng() * Math.PI * 2;
  const vertical = randomRange(-1, 1, rng);
  const planar = Math.sqrt(1 - vertical * vertical);
  const distance = randomRange(scatterRadius * 0.38, scatterRadius, rng);

  return {
    x: point.x + Math.cos(theta) * planar * distance,
    y: point.y + vertical * distance + randomRange(-1.2, 1.2, rng),
    z: point.z + Math.sin(theta) * planar * distance
  };
}

function colorForComponent(name, point, rng) {
  if (name === "flame") {
    return mix(PALETTE.flameCore, PALETTE.flameEdge, rng() * 0.75);
  }

  if (name === "pedestal") {
    return mix(PALETTE.stone, PALETTE.shadowCopper, rng() * 0.25);
  }

  const highlightBias = Math.max(0, (point.y + 3) / 6) * 0.25 + rng() * 0.25;
  return mix(PALETTE.oxidizedCopper, PALETTE.highlight, highlightBias);
}

function calculateBounds(positions) {
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

function mix(a, b, amount) {
  const t = Math.max(0, Math.min(1, amount));
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t
  ];
}

function randomRange(min, max, rng) {
  return min + (max - min) * rng();
}
