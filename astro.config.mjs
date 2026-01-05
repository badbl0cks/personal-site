import htmx from "astro-htmx";
// @ts-check
import { defineConfig } from "astro/config";
import alpinejs from "@astrojs/alpinejs";
import partytown from "@astrojs/partytown";
import sitemap from "@astrojs/sitemap";
import bun from "@nurodev/astro-bun";

// https://astro.build/config
export default defineConfig({
  site: "https://badblocks.dev",
  adapter: bun(),
  output: "static",
  integrations: [
    alpinejs(),
    partytown(),
    sitemap(),
    htmx(),
    // sitemap({
    //   filter: (page) =>
    //     page !== "https://example.com/secret-vip-lounge-1/" &&
    //     page !== "https://example.com/secret-vip-lounge-2/",
    // }),
  ],
});
