import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig(({ mode }) => {
  const umd = mode === "umd";

  return {
    build: {
      emptyOutDir: !umd,
      lib: {
        entry: resolve(__dirname, "src/index.ts"),
        name: "ResourceCalendar",
        fileName: () =>
          umd ? "resourcecalendar.umd.cjs" : "resourcecalendar.js",
        formats: [umd ? "umd" : "es"],
      },
      cssCodeSplit: false,
      rollupOptions: {
        external: umd ? [] : ["temporal-polyfill"],
        output: { exports: "named" },
      },
    },
  };
});
