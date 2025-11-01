import { defineConfig } from "astro/config";
import node from "@astrojs/node";

// Astro configuration for the Web98 port:
// - Uses Node adapter for SSR builds (standalone output)

export default defineConfig({
  output: "server",
  adapter: node({
    mode: "standalone",
  }),
});
