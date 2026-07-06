import * as THREE from "three";
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

let particleData = generateStatueParticles({ count: 18000, seed: 1886 });
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
particles.rotation.y = -0.28;
scene.add(particles);
applyResponsiveFrame();

const starField = createStarField();
scene.add(starField);
loadDetailedStatue();

let isDisintegrated = false;
let transition = 0;
let targetTransition = 0;
let pointerStartedOnButton = false;
const pointer = { x: 0, y: 0 };
const clock = new THREE.Clock();

globalThis.__libertyDebug = {
  getTransition: () => transition,
  isDisintegrated: () => isDisintegrated,
  getParticleSource: () => particleData.source ?? "procedural",
  getParticleCount: () => particleData.count
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
  applyResponsiveFrame();
});

function animate() {
  const delta = Math.min(clock.getDelta(), 0.05);
  const elapsed = clock.elapsedTime;

  transition += (targetTransition - transition) * Math.min(1, delta * 2.4);
  updateParticlePositions(easeInOutCubic(transition));

  particles.rotation.y += 0.0016;
  particles.rotation.x += ((-pointer.y * 0.07) - particles.rotation.x) * 0.04;
  camera.position.x += (pointer.x * 0.35 - camera.position.x) * 0.035;
  camera.lookAt(0.04, -0.05, 0);
  starField.rotation.y -= 0.00045;
  material.uniforms.time.value = elapsed;

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

function updateParticlePositions(progress) {
  const source = particleData.targetPositions;
  const destination = particleData.scatterPositions;

  for (let index = 0; index < positions.length; index += 1) {
    positions[index] = source[index] + (destination[index] - source[index]) * progress;
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
    stateLabel.textContent = isDisintegrated ? "Disintegrated" : "Assembled";
  } catch (error) {
    console.warn("Falling back to procedural statue particles.", error);
    stateLabel.textContent = "Assembled";
  }
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
