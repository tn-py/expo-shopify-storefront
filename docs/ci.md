# CI/CD

## Workflows

### `.github/workflows/ci.yml`

Runs on every push to `main`, every pull request, and on demand
(`workflow_dispatch`). One run per ref at a time — a new push to the same PR
cancels the previous run in flight (pushes to `main` are never cancelled).

- **`checks`** — the fast, always-blocking job:
  1. Install (`npm ci`), create a placeholder `.env` (`cp .env.example .env`,
     i.e. demo mode — no real store credentials in CI).
  2. Guard: fail if any `*.test.*` file exists under `src/app/`. Expo Router
     treats every file under `src/app/` as part of the route tree, so a test
     file there gets bundled as (or breaks) a route. Tests belong next to the
     code they cover, under `src/`.
  3. Typecheck (`tsc --noEmit`), lint (`expo lint`), tests
     (`jest --runInBand --ci`).
  4. `scripts/check-env.mjs --offline` against a **synthetic** `.env` written
     inline in the step (obviously-fake domain/token/etc., not the
     placeholder `.env.example`) — `.env.example` is *supposed* to fail this
     check (blank Storefront token), so running it there would only prove the
     script correctly rejects blanks, not that every validation rule still
     works end to end. `--offline` skips the live Storefront API ping. The
     placeholder `.env` is restored afterwards.
  5. `npx expo-doctor` — blocking. Kept blocking rather than
     `continue-on-error` because this template tracks a fast-moving SDK, and
     doctor catches native-dependency/config-plugin drift that typecheck,
     lint, and jest can't see; if it starts flagging something that's a false
     positive for this repo, fix that specifically (e.g. an expo-doctor
     ignore config) rather than making the whole check non-blocking.

- **`export`** — a platform matrix (`ios`, `android`) that runs
  `npx expo export --platform <platform> --output-dir dist-<platform>`
  against the same placeholder `.env` (demo mode). This is what actually
  catches Metro resolution errors and route-bundle problems (including a
  stray test file under `src/app/`, which the guard step also catches
  faster) — `tsc`/`eslint`/`jest` don't bundle the app, so they can miss
  these. Runs in parallel with `checks` rather than after it, since it's an
  independent, cheap (~1–2 min) signal and most changes pass both — gating it
  on `checks` would only slow down the common case. No build artifacts are
  uploaded; the export's job is just to succeed or fail.

Both jobs use `node-version-file: .node-version` (Node 22) and cache `npm`.
`permissions: contents: read` at the workflow level — nothing here needs to
write to the repo or call other GitHub APIs.

## Running the same checks locally

```sh
cp .env.example .env
npm run verify              # typecheck + lint + jest --runInBand
npm run check:env -- --offline   # against your own filled .env — expect
                                  # errors against an unfilled .env.example
npx expo-doctor
npx expo export --platform android --output-dir /tmp/export-android
npx expo export --platform ios --output-dir /tmp/export-ios
```

The `src/app/` test-file guard has no separate script — it's one `find`
command (see `ci.yml`); run it yourself with:

```sh
find src/app -type f -name '*.test.*'
```

(should print nothing).

## Dependabot

`.github/dependabot.yml`:

- **npm, weekly** — minor/patch bumps for everything are grouped into one PR
  to keep volume down. Major bumps for Expo-managed packages (`expo`,
  `expo-*`, `react`, `react-native`, `react-native-*`, `@expo/*`, `jest-expo`,
  `eslint-config-expo`, `react-native-reanimated`, `react-native-worklets`,
  `@react-native-async-storage/async-storage`) are **ignored entirely** —
  these move together on an SDK boundary, and Dependabot bumping one in
  isolation produces a broken native build. Upgrade them together instead:
  bump `expo` in `package.json`, run `npx expo install --fix` to realign
  every Expo-managed package, then `npx expo-doctor && npm run verify` and a
  full rebuild. Major bumps for everything else still open individually.
  Capped at 5 open PRs at a time.
- **github-actions, monthly** — action version bumps, capped at 5 open PRs.

## EAS Workflows

`.eas/workflows/` has two example workflows (`preview-update.yml`,
`production-build.yml`). These run on Expo's own infrastructure via the EAS
GitHub app — **not** GitHub Actions — and need one-time setup before they do
anything:

1. `eas init` (links the repo to an EAS project).
2. Install the [EAS GitHub app](https://expo.dev/settings/github) on this
   repo.
3. Set EAS Environment Variables per environment (`development` / `preview` /
   `production` — see the `environment` key on each `eas.json` build
   profile).

See [docs/release-checklist.md](./release-checklist.md#4-eas) and
<https://docs.expo.dev/eas/workflows/get-started/>. Both files are commented
with what each does; `production-build.yml`'s submit jobs are commented out
by default so a tag push builds but doesn't auto-submit until you turn that
on deliberately.
