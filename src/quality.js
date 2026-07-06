export const QUALITY_STORAGE_KEY = "liberty-particle-quality";

export const QUALITY_COUNTS = {
  performance: 45000,
  balanced: 70000,
  high: 120000,
  ultra: 180000
};

export const QUALITY_OPTIONS = [
  { mode: "auto", label: "Auto" },
  { mode: "performance", label: "Performance", particleCount: QUALITY_COUNTS.performance },
  { mode: "high", label: "High", particleCount: QUALITY_COUNTS.high },
  { mode: "ultra", label: "Ultra", particleCount: QUALITY_COUNTS.ultra }
];

const QUALITY_MODES = new Set(QUALITY_OPTIONS.map((option) => option.mode));

export function normalizeQualityMode(mode) {
  return QUALITY_MODES.has(mode) ? mode : "auto";
}

export function resolveParticleCount(mode, profile = {}) {
  const normalizedMode = normalizeQualityMode(mode);

  if (normalizedMode === "performance") {
    return QUALITY_COUNTS.performance;
  }

  if (normalizedMode === "high") {
    return QUALITY_COUNTS.high;
  }

  if (normalizedMode === "ultra") {
    return QUALITY_COUNTS.ultra;
  }

  const width = profile.width ?? 1024;
  const pixelRatio = profile.pixelRatio ?? 1;
  const cores = profile.cores ?? 4;
  const memory = profile.memory ?? 8;

  if (width < 760 || (width < 920 && pixelRatio >= 2.25) || cores <= 4 || memory <= 4) {
    return QUALITY_COUNTS.performance;
  }

  if (width >= 1280 && pixelRatio <= 2 && cores >= 8 && memory >= 8) {
    return QUALITY_COUNTS.high;
  }

  return QUALITY_COUNTS.balanced;
}

export function createDeviceProfile(windowLike = {}, navigatorLike = {}) {
  return {
    width: windowLike.innerWidth ?? 1024,
    pixelRatio: windowLike.devicePixelRatio ?? 1,
    cores: navigatorLike.hardwareConcurrency ?? 4,
    memory: navigatorLike.deviceMemory ?? 8
  };
}

export function getQualityLabel(mode) {
  return QUALITY_OPTIONS.find((option) => option.mode === normalizeQualityMode(mode))?.label ?? "Auto";
}
