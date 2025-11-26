/// <reference types="vite/client" />

// Do NOT hardcode secret values here. This file provides typings for
// Vite's `import.meta.env` variables. Secrets must come from runtime
// environment variables (server-side) or from a local `.env` file that
// is NOT committed to source control.

interface ImportMetaEnv {
  readonly GEMINI_API_KEY?: string; // optional, but avoid storing real secrets client-side
}

declare interface ImportMeta {
  readonly env: ImportMetaEnv;
}
