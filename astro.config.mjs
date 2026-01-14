import htmx from "astro-htmx";
// @ts-check
import { defineConfig, envField } from "astro/config";
import alpinejs from "@astrojs/alpinejs";
import sitemap from "@astrojs/sitemap";
import bun from "@nurodev/astro-bun";
import db from "@astrojs/db";

// https://astro.build/config
export default defineConfig({
  site: "https://badblocks.dev",
  trailingSlash: "never",
  adapter: bun(),
  output: "static",
  devToolbar: { enabled: false },
  prefetch: {
    prefetchAll: true,
  },
  security: {
    checkOrigin: true,
  },
  session: {
    driver: "lru-cache",
    ttl: 3600,
    maxEntries: 1000,
  },
  server: {
    host: true,
    port: 4321,
  },
  env: {
    schema: {
      ANDROID_SMS_GATEWAY_LOGIN: envField.string({
        context: "server",
        access: "secret",
      }),
      ANDROID_SMS_GATEWAY_PASSWORD: envField.string({
        context: "server",
        access: "secret",
      }),
      ANDROID_SMS_GATEWAY_RECIPIENT_PHONE: envField.string({
        context: "server",
        access: "secret",
      }),
      ANDROID_SMS_GATEWAY_URL: envField.string({
        context: "server",
        access: "secret",
      }),
      OTP_SUPER_SECRET_SALT: envField.string({
        context: "server",
        access: "secret",
      }),
    },
  },
  integrations: [alpinejs(), sitemap(), htmx(), db()],
  experimental: {
    preserveScriptOrder: true,
    chromeDevtoolsWorkspace: true,
    failOnPrerenderConflict: true,
  },
});
