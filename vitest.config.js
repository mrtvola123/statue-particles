import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.js"],
    coverage: {
      provider: "v8",
      include: ["src/statue.js", "src/modelParticles.js", "src/celebration.js", "src/quality.js"],
      reporter: ["text"],
      thresholds: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80
      }
    }
  }
});
