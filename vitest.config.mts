import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    include: ["tests/**/*.test.ts"],
    // The route tests import Next route modules (Auth.js, Drizzle, the engine);
    // the cold import is charged to whichever test reaches it first, which on a
    // cold machine blows the 5 s default and fails a different set each run.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
