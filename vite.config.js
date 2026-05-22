import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.js"),
      name: "ResourceCalendar",
      fileName: (format) => `resourcecalendar.${format}.js`,
      formats: ["es", "umd"],
    },
    cssCodeSplit: false,
  },
});
