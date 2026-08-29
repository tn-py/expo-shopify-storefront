# App assets

The PNGs in `images/` are **neutral placeholders** (a shopping-bag glyph on the
default accent colour). Replace them with your own brand art — keep the same
filenames and the config in `app.config.ts` picks them up with no code change.

| File | Size | Used for | Notes |
| --- | --- | --- | --- |
| `images/icon.png` | 1024×1024 | iOS + base app icon | Opaque, no transparency, no rounded corners (the OS masks it). |
| `images/android-icon-foreground.png` | 1024×1024 | Android adaptive icon foreground | Transparent background. Keep artwork within the centre ~66% (safe zone) — the outer edge is cropped on some launchers. |
| `images/android-icon-monochrome.png` | 1024×1024 | Android themed icon | Transparent background, single-colour silhouette (Android tints it). |
| `images/splash-icon.png` | 1024×1024 | Splash screen logo | Transparent background. Displayed at `imageWidth: 220` on `EXPO_PUBLIC_APP_BACKGROUND`. |
| `images/favicon.png` | 48×48 | Web favicon | |

The Android adaptive-icon **background** is the flat colour
`EXPO_PUBLIC_APP_BACKGROUND` (no image file).

## Regenerating

Any image editor works. To script it, `npx @expo/image-utils` or ImageMagick
(`magick source.svg -resize 1024x1024 images/icon.png`). After changing icons,
rebuild the dev client (`eas build --profile development`) — icons are baked in
at build time, not delivered over the air.
