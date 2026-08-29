# Notes for AI coding agents

- This is an **Expo SDK 57** project. APIs changed a lot in recent SDKs — check
  the versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing
  native or config code.
- All store-specific configuration lives in `.env` (see `.env.example`) and is
  read through `src/shopify/env.ts` and `app.config.ts`. Don't hard-code store
  names, domains, colours, bundle ids, or URLs anywhere else.
- Routes live in `src/app/` (Expo Router, typed routes on). App code lives in
  `src/`; only screens/layouts go in `src/app/`.
- Before committing: `npm run typecheck && npm run lint`.
