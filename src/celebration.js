export const INTRO_SEQUENCE = [
  { label: "1776", start: 0, end: 2.1 },
  { label: "2026", start: 2.1, end: 4.2 },
  { label: "AMERICA 250", start: 4.2, end: 7.0 }
];

export function getAmerica250IntroFrame(elapsedSeconds) {
  const frame = INTRO_SEQUENCE.find(
    (item) => elapsedSeconds >= item.start && elapsedSeconds < item.end
  );

  if (!frame) {
    return { label: "", opacity: 0, progress: 1, isComplete: true };
  }

  const duration = frame.end - frame.start;
  const progress = clamp((elapsedSeconds - frame.start) / duration, 0, 1);
  const fadeIn = smoothstep(0, 0.22, progress);
  const fadeOut = 1 - smoothstep(0.78, 1, progress);

  return {
    label: frame.label,
    opacity: Math.min(fadeIn, fadeOut),
    progress,
    isComplete: false
  };
}

export function createFireworkSchedule({ duration = 10, interval = 1.15, startAt = 1.1 } = {}) {
  const events = [];

  for (let time = startAt; time <= duration; time += interval) {
    events.push({
      time: Number(time.toFixed(2)),
      x: 4.0 + wave(time * 1.7) * 1.15,
      y: 0.65 + Math.abs(wave(time * 0.9)) * 1.25,
      z: 0.3 - Math.abs(wave(time * 1.3)) * 0.45
    });
  }

  return events;
}

function smoothstep(edge0, edge1, value) {
  const x = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return x * x * (3 - 2 * x);
}

function wave(value) {
  return Math.sin(value) * 0.72 + Math.sin(value * 2.31) * 0.28;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
