/// <reference types="astro/client" />

/**
 * Ambient env type declarations for the Web98 Astro port.
 *
 * Notes:
 * - Variables WITHOUT the PUBLIC_ prefix are server-only and are not exposed to the client.
 * - Variables WITH the PUBLIC_ prefix can be accessed in client-side code.
 * - The OpenRouter API key is NOT managed server-side in this project; users provide it in the browser.
 */

interface ImportMetaEnv {
  // No server-side API key; users enter their key in the Settings modal

  // Optional site metadata for tags/headers
  readonly OPENROUTER_API_BASE?: string; // e.g. "https://openrouter.ai/api/v1"
  readonly OPENROUTER_MODEL?: string; // e.g. "moonshotai/kimi-k2-0905"
  readonly OPENROUTER_SITE_URL?: string; // e.g. "http://localhost:4321"
  readonly OPENROUTER_APP_NAME?: string; // e.g. "Web98 Astro"

  // Astro dev server convenience vars
  readonly HOST?: string; // e.g. "0.0.0.0"
  readonly PORT?: string; // e.g. "4321"

  // Example client-exposed variables (add as needed):
  // readonly PUBLIC_SOME_FLAG?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
