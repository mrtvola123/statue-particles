import * as THREE from "three";
import { createFireworkSchedule, getAmerica250IntroFrame } from "./celebration.js";
import { generateStatueParticles } from "./statue.js";
import "./style.css";

const canvas = document.querySelector("#liberty-canvas");
const toggleButton = document.querySelector("#toggle-button");
const buttonLabel = document.querySelector("#button-label");
const stateLabel = document.querySelector("#state-label");

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x061114, 0.055);

const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0.2, 0.2, 12.6);

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: false,
  preserveDrawingBuffer: true
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x061114, 1);

let particleData = createEmptyParticleData();
let positions = new Float32Array(particleData.targetPositions);
const geometry = new THREE.BufferGeometry();
geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
geometry.setAttribute("color", new THREE.BufferAttribute(particleData.colors, 3));
geometry.setAttribute("size", new THREE.BufferAttribute(particleData.sizes, 1));

const material = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  blending: THREE.NormalBlending,
  vertexColors: true,
  uniforms: {
    pixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
    time: { value: 0 }
  },
  vertexShader: `
    attribute float size;
    varying vec3 vColor;
    uniform float pixelRatio;
    uniform float time;

    void main() {
      vColor = color;
      vec3 animated = position;
      animated.x += sin(time * 0.9 + position.y * 2.4) * 0.018;
      animated.z += cos(time * 0.7 + position.x * 3.0) * 0.014;
      vec4 modelViewPosition = modelViewMatrix * vec4(animated, 1.0);
      gl_PointSize = size * pixelRatio * (42.0 / -modelViewPosition.z);
      gl_Position = projectionMatrix * modelViewPosition;
    }
  `,
  fragmentShader: `
    varying vec3 vColor;

    void main() {
      vec2 centered = gl_PointCoord - vec2(0.5);
      float distanceToCenter = length(centered);
      float alpha = smoothstep(0.5, 0.05, distanceToCenter);
      gl_FragColor = vec4(vColor, alpha * 0.86);
    }
  `
});

const particles = new THREE.Points(geometry, material);
particles.visible = false;
particles.rotation.y = -0.28;
scene.add(particles);
applyResponsiveFrame();

const starField = createStarField();
scene.add(starField);
const celebration = createCelebrationScene();
scene.add(celebration.group);
loadDetailedStatue();

let isDisintegrated = false;
let transition = 0;
let targetTransition = 0;
let pointerStartedOnButton = false;
let introStartedAt = null;
let nextFireworkIndex = 0;
const pointer = { x: 0, y: 0 };
const clock = new THREE.Clock();
const shockwaves = [];

globalThis.__libertyDebug = {
  getTransition: () => transition,
  isDisintegrated: () => isDisintegrated,
  isParticleVisible: () => particles.visible,
  getParticleSource: () => particleData.source ?? "procedural",
  getParticleCount: () => particleData.count,
  getIntroLabel: () => celebration.currentLabel,
  getActiveFireworks: () => celebration.activeBursts
};

function toggleDisintegration() {
  isDisintegrated = !isDisintegrated;
  targetTransition = isDisintegrated ? 1 : 0;
  buttonLabel.textContent = isDisintegrated ? "Rebuild" : "Disintegrate";
  stateLabel.textContent = isDisintegrated ? "Disintegrated" : "Assembled";
  document.body.dataset.state = isDisintegrated ? "disintegrated" : "assembled";
}

toggleButton.addEventListener("pointerdown", () => {
  pointerStartedOnButton = true;
});

toggleButton.addEventListener("click", (event) => {
  event.stopPropagation();
  toggleDisintegration();
});

window.addEventListener("click", () => {
  if (pointerStartedOnButton) {
    pointerStartedOnButton = false;
    return;
  }

  toggleDisintegration();
});

window.addEventListener("pointermove", (event) => {
  pointer.x = (event.clientX / window.innerWidth - 0.5) * 2;
  pointer.y = (event.clientY / window.innerHeight - 0.5) * 2;
});

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  material.uniforms.pixelRatio.value = Math.min(window.devicePixelRatio, 2);
  celebration.text.material.uniforms.pixelRatio.value = Math.min(window.devicePixelRatio, 2);
  applyResponsiveFrame();
});

function animate() {
  const delta = Math.min(clock.getDelta(), 0.05);
  const elapsed = clock.elapsedTime;

  transition += (targetTransition - transition) * Math.min(1, delta * 2.4);
  updateParticlePositions(easeInOutCubic(transition), elapsed);
  updateCelebration(delta, elapsed);

  particles.rotation.y += 0.0016;
  particles.rotation.x += ((-pointer.y * 0.07) - particles.rotation.x) * 0.04;
  camera.position.x += (pointer.x * 0.35 - camera.position.x) * 0.035;
  camera.lookAt(0.04, -0.05, 0);
  starField.rotation.y -= 0.00045;
  material.uniforms.time.value = elapsed;

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

function updateParticlePositions(progress, elapsed) {
  const source = particleData.targetPositions;
  const destination = particleData.scatterPositions;

  for (let index = 0; index < positions.length; index += 3) {
    let x = source[index] + (destination[index] - source[index]) * progress;
    let y = source[index + 1] + (destination[index + 1] - source[index + 1]) * progress;
    let z = source[index + 2] + (destination[index + 2] - source[index + 2]) * progress;

    for (const shockwave of shockwaves) {
      const age = elapsed - shockwave.time;

      if (age <= 0 || age > 2.2) {
        continue;
      }

      const dx = source[index] - shockwave.x;
      const dy = source[index + 1] - shockwave.y;
      const dz = source[index + 2] - shockwave.z;
      const distance = Math.hypot(dx, dy, dz) + 0.001;
      const waveRadius = age * 5.2;
      const ring = Math.exp(-Math.pow(distance - waveRadius, 2) * 1.8);
      const force = ring * (1 - age / 2.2) * shockwave.force;

      x += (dx / distance) * force;
      y += (dy / distance) * force;
      z += (dz / distance) * force;
    }

    positions[index] = x;
    positions[index + 1] = y;
    positions[index + 2] = z;
  }

  geometry.attributes.position.needsUpdate = true;
}

async function loadDetailedStatue() {
  try {
    const [{ GLTFLoader }, { generateModelParticles }] = await Promise.all([
      import("three/examples/jsm/loaders/GLTFLoader.js"),
      import("./modelParticles.js")
    ]);
    const gltf = await new GLTFLoader().loadAsync("/models/libertystatue.glb");
    const meshParticles = generateModelParticles(gltf.scene, {
      count: 70000,
      seed: 1886,
      height: 6.7,
      scatterRadius: 8.9
    });

    replaceParticleData(meshParticles);
    particles.visible = true;
    stateLabel.textContent = isDisintegrated ? "Disintegrated" : "Assembled";
    startAmerica250Intro();
  } catch (error) {
    console.warn("Falling back to procedural statue particles.", error);
    replaceParticleData(generateStatueParticles({ count: 18000, seed: 1886 }));
    particles.visible = true;
    stateLabel.textContent = "Assembled";
  }
}

function startAmerica250Intro() {
  introStartedAt = clock.elapsedTime;
  nextFireworkIndex = 0;
  celebration.text.visible = true;
  celebration.fireworks.visible = true;
  document.body.dataset.celebration = "america250";
}

function replaceParticleData(nextParticleData) {
  particleData = nextParticleData;
  const nextPositions = isDisintegrated
    ? particleData.scatterPositions
    : particleData.targetPositions;

  positions = new Float32Array(nextPositions);
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(particleData.colors, 3));
  geometry.setAttribute("size", new THREE.BufferAttribute(particleData.sizes, 1));
  geometry.attributes.position.needsUpdate = true;
}

function createEmptyParticleData() {
  return {
    count: 0,
    source: "loading",
    targetPositions: new Float32Array(0),
    scatterPositions: new Float32Array(0),
    colors: new Float32Array(0),
    sizes: new Float32Array(0)
  };
}

function createStarField() {
  const rng = mulberry32(77);
  const starCount = 900;
  const starPositions = new Float32Array(starCount * 3);
  const starColors = new Float32Array(starCount * 3);

  for (let index = 0; index < starCount; index += 1) {
    const offset = index * 3;
    const radius = 18 + rng() * 18;
    const theta = rng() * Math.PI * 2;
    const phi = Math.acos(2 * rng() - 1);
    starPositions[offset] = Math.sin(phi) * Math.cos(theta) * radius;
    starPositions[offset + 1] = Math.cos(phi) * radius;
    starPositions[offset + 2] = Math.sin(phi) * Math.sin(theta) * radius - 7;
    starColors[offset] = 0.35 + rng() * 0.25;
    starColors[offset + 1] = 0.58 + rng() * 0.25;
    starColors[offset + 2] = 0.62 + rng() * 0.32;
  }

  const starGeometry = new THREE.BufferGeometry();
  starGeometry.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
  starGeometry.setAttribute("color", new THREE.BufferAttribute(starColors, 3));

  const starMaterial = new THREE.PointsMaterial({
    size: 0.025,
    vertexColors: true,
    transparent: true,
    opacity: 0.62,
    depthWrite: false
  });

  return new THREE.Points(starGeometry, starMaterial);
}

function createCelebrationScene() {
  const group = new THREE.Group();
  const text = createIntroTextParticles();
  const fireworks = createFireworks();

  text.visible = false;
  fireworks.visible = false;
  group.add(text, fireworks);

  return {
    group,
    text,
    fireworks,
    schedule: createFireworkSchedule({ duration: 13 }),
    currentLabel: "",
    activeBursts: 0
  };
}

function updateCelebration(delta, elapsed) {
  if (introStartedAt === null) {
    return;
  }

  const introElapsed = elapsed - introStartedAt;
  const introFrame = getAmerica250IntroFrame(introElapsed);
  updateIntroText(introFrame, elapsed);
  updateFireworks(delta, introElapsed, elapsed);

  for (let index = shockwaves.length - 1; index >= 0; index -= 1) {
    if (elapsed - shockwaves[index].time > 2.2) {
      shockwaves.splice(index, 1);
    }
  }
}

function createIntroTextParticles() {
  const maxPoints = 2200;
  const textPositions = new Float32Array(maxPoints * 3);
  const textColors = new Float32Array(maxPoints * 3);
  const textSizes = new Float32Array(maxPoints);
  const textGeometry = new THREE.BufferGeometry();
  textGeometry.setAttribute("position", new THREE.BufferAttribute(textPositions, 3));
  textGeometry.setAttribute("color", new THREE.BufferAttribute(textColors, 3));
  textGeometry.setAttribute("size", new THREE.BufferAttribute(textSizes, 1));
  textGeometry.setDrawRange(0, 0);

  const textMaterial = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexColors: true,
    uniforms: {
      pixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
      opacity: { value: 0 },
      time: { value: 0 }
    },
    vertexShader: `
      attribute float size;
      varying vec3 vColor;
      uniform float pixelRatio;
      uniform float time;

      void main() {
        vColor = color;
        vec3 animated = position;
        animated.y += sin(time * 2.0 + position.x * 3.0) * 0.012;
        vec4 modelViewPosition = modelViewMatrix * vec4(animated, 1.0);
        gl_PointSize = size * pixelRatio * (84.0 / -modelViewPosition.z);
        gl_Position = projectionMatrix * modelViewPosition;
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      uniform float opacity;

      void main() {
        vec2 centered = gl_PointCoord - vec2(0.5);
        float alpha = smoothstep(0.48, 0.08, length(centered));
        gl_FragColor = vec4(vColor, alpha * opacity);
      }
    `
  });

  const textPoints = new THREE.Points(textGeometry, textMaterial);
  textPoints.userData = {
    maxPoints,
    currentLabel: "",
    positions: textPositions,
    colors: textColors,
    sizes: textSizes
  };
  textPoints.position.set(1.12, 0.35, 0.55);

  return textPoints;
}

function updateIntroText(frame, elapsed) {
  celebration.currentLabel = frame.label;
  celebration.text.material.uniforms.opacity.value = frame.opacity;
  celebration.text.material.uniforms.time.value = elapsed;

  if (frame.isComplete) {
    celebration.text.visible = false;
    celebration.currentLabel = "";
    return;
  }

  celebration.text.visible = true;

  if (celebration.text.userData.currentLabel !== frame.label) {
    rebuildIntroText(frame.label);
  }
}

function rebuildIntroText(label) {
  const canvas2d = document.createElement("canvas");
  const size = 512;
  canvas2d.width = size;
  canvas2d.height = 180;
  const context = canvas2d.getContext("2d", { willReadFrequently: true });
  context.clearRect(0, 0, canvas2d.width, canvas2d.height);
  context.fillStyle = "#fff";
  context.font = label.length > 5 ? "800 62px Arial" : "900 104px Arial";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(label, canvas2d.width / 2, canvas2d.height / 2);

  const image = context.getImageData(0, 0, canvas2d.width, canvas2d.height);
  const points = [];

  for (let y = 0; y < image.height; y += 4) {
    for (let x = 0; x < image.width; x += 4) {
      const alpha = image.data[(y * image.width + x) * 4 + 3];

      if (alpha > 64) {
        points.push({ x, y });
      }
    }
  }

  const data = celebration.text.userData;
  const pointCount = Math.min(data.maxPoints, points.length);
  const stride = Math.max(1, Math.floor(points.length / pointCount));

  for (let index = 0; index < pointCount; index += 1) {
    const point = points[index * stride];
    const offset = index * 3;
    const colorBand = index % 3;

    data.positions[offset] = (point.x / image.width - 0.5) * 3.8;
    data.positions[offset + 1] = -(point.y / image.height - 0.5) * 1.35;
    data.positions[offset + 2] = (Math.sin(index * 12.9898) * 0.5 + 0.5) * 0.08;

    data.colors[offset] = colorBand === 0 ? 0.95 : colorBand === 1 ? 0.92 : 0.2;
    data.colors[offset + 1] = colorBand === 0 ? 0.22 : colorBand === 1 ? 0.94 : 0.46;
    data.colors[offset + 2] = colorBand === 0 ? 0.24 : colorBand === 1 ? 0.95 : 0.95;
    data.sizes[index] = 1.05 + (index % 5) * 0.1;
  }

  celebration.text.geometry.setDrawRange(0, pointCount);
  celebration.text.geometry.attributes.position.needsUpdate = true;
  celebration.text.geometry.attributes.color.needsUpdate = true;
  celebration.text.geometry.attributes.size.needsUpdate = true;
  celebration.text.userData.currentLabel = label;
}

function createFireworks() {
  const burstCount = 8;
  const particlesPerBurst = 180;
  const totalParticles = burstCount * particlesPerBurst;
  const fireworkPositions = new Float32Array(totalParticles * 3);
  const fireworkColors = new Float32Array(totalParticles * 3);
  const fireworkSizes = new Float32Array(totalParticles);
  const fireworkGeometry = new THREE.BufferGeometry();
  fireworkGeometry.setAttribute("position", new THREE.BufferAttribute(fireworkPositions, 3));
  fireworkGeometry.setAttribute("color", new THREE.BufferAttribute(fireworkColors, 3));
  fireworkGeometry.setAttribute("size", new THREE.BufferAttribute(fireworkSizes, 1));

  const fireworkMaterial = new THREE.PointsMaterial({
    size: 0.48,
    sizeAttenuation: true,
    vertexColors: true,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending
  });

  const fireworkPoints = new THREE.Points(fireworkGeometry, fireworkMaterial);
  const bursts = Array.from({ length: burstCount }, (_, burstIndex) => ({
    active: false,
    birth: 0,
    origin: new THREE.Vector3(),
    velocities: Array.from({ length: particlesPerBurst }, (_, particleIndex) =>
      createFireworkVelocity(burstIndex, particleIndex)
    )
  }));

  for (let index = 0; index < totalParticles; index += 1) {
    const offset = index * 3;
    fireworkPositions[offset] = 0;
    fireworkPositions[offset + 1] = -99;
    fireworkPositions[offset + 2] = 0;
    fireworkSizes[index] = 1.35 + (index % 7) * 0.16;
  }

  fireworkPoints.userData = {
    burstCount,
    particlesPerBurst,
    bursts,
    positions: fireworkPositions,
    colors: fireworkColors,
    sizes: fireworkSizes
  };
  fireworkPoints.position.set(0.4, 0.15, 1.9);

  return fireworkPoints;
}

function updateFireworks(delta, introElapsed, elapsed) {
  while (
    nextFireworkIndex < celebration.schedule.length &&
    introElapsed >= celebration.schedule[nextFireworkIndex].time
  ) {
    launchFirework(celebration.schedule[nextFireworkIndex], elapsed);
    nextFireworkIndex += 1;
  }

  const data = celebration.fireworks.userData;
  celebration.activeBursts = 0;

  for (let burstIndex = 0; burstIndex < data.bursts.length; burstIndex += 1) {
    const burst = data.bursts[burstIndex];
    const age = elapsed - burst.birth;

    if (!burst.active || age > 2.4) {
      burst.active = false;
      hideFireworkBurst(burstIndex);
      continue;
    }

    celebration.activeBursts += 1;
    const fade = 1 - age / 2.4;

    for (let particleIndex = 0; particleIndex < data.particlesPerBurst; particleIndex += 1) {
      const globalIndex = burstIndex * data.particlesPerBurst + particleIndex;
      const offset = globalIndex * 3;
      const velocity = burst.velocities[particleIndex];
      const gravity = age * age * 0.28;

      data.positions[offset] = burst.origin.x + velocity.x * age;
      data.positions[offset + 1] = burst.origin.y + velocity.y * age - gravity;
      data.positions[offset + 2] = burst.origin.z + velocity.z * age;
      data.sizes[globalIndex] = (1.35 + (particleIndex % 7) * 0.16) * (0.45 + fade);
    }
  }

  celebration.fireworks.geometry.attributes.position.needsUpdate = true;
  celebration.fireworks.geometry.attributes.color.needsUpdate = true;
  celebration.fireworks.geometry.attributes.size.needsUpdate = true;
}

function launchFirework(event, elapsed) {
  const data = celebration.fireworks.userData;
  const burstIndex = nextFireworkIndex % data.burstCount;
  const burst = data.bursts[burstIndex];
  burst.active = true;
  burst.birth = elapsed;
  burst.origin.set(event.x, event.y, event.z);
  colorFireworkBurst(burstIndex, nextFireworkIndex);
  shockwaves.push({
    time: elapsed,
    x: event.x - particles.position.x,
    y: event.y - particles.position.y,
    z: event.z,
    force: 0.22
  });
}

function colorFireworkBurst(burstIndex, paletteIndex) {
  const data = celebration.fireworks.userData;
  const palettes = [
    [0.98, 0.18, 0.24],
    [0.85, 0.95, 1],
    [0.22, 0.48, 1],
    [1, 0.78, 0.26]
  ];

  for (let particleIndex = 0; particleIndex < data.particlesPerBurst; particleIndex += 1) {
    const globalIndex = burstIndex * data.particlesPerBurst + particleIndex;
    const offset = globalIndex * 3;
    const color = palettes[(paletteIndex + particleIndex) % palettes.length];
    data.colors[offset] = color[0];
    data.colors[offset + 1] = color[1];
    data.colors[offset + 2] = color[2];
  }
}

function hideFireworkBurst(burstIndex) {
  const data = celebration.fireworks.userData;

  for (let particleIndex = 0; particleIndex < data.particlesPerBurst; particleIndex += 1) {
    const globalIndex = burstIndex * data.particlesPerBurst + particleIndex;
    const offset = globalIndex * 3;
    data.positions[offset] = 0;
    data.positions[offset + 1] = -99;
    data.positions[offset + 2] = 0;
  }
}

function createFireworkVelocity(burstIndex, particleIndex) {
  const phi = Math.acos(1 - 2 * ((particleIndex + 0.5) / 180));
  const theta = particleIndex * 2.399963 + burstIndex * 0.37;
  const speed = 0.62 + ((particleIndex * 17 + burstIndex * 11) % 29) / 44;

  return {
    x: Math.sin(phi) * Math.cos(theta) * speed,
    y: Math.cos(phi) * speed * 0.78,
    z: Math.sin(phi) * Math.sin(theta) * speed
  };
}


function applyResponsiveFrame() {
  const isCompact = window.innerWidth < 720;
  camera.position.z = isCompact ? 15.4 : 12.6;
  particles.position.x = isCompact ? 1.18 : 1.08;
  particles.position.y = isCompact ? -0.55 : -0.05;
}

function easeInOutCubic(value) {
  return value < 0.5 ? 4 * value * value * value : 1 - Math.pow(-2 * value + 2, 3) / 2;
}

function mulberry32(seed) {
  let state = seed;

  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

animate();
