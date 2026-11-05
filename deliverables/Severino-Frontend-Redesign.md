# Severino frontend redesign

Implemented on 6 November 2026 from the approved olive-and-cream concept board.

## Recovery checkpoint

The original application is preserved at Git tag `severino-1.0`, commit `09851a72820676fe46d03683c4cba246bcb2e8f3`. A complete archive of tracked source is available at `deliverables/Severino-1.0-source.zip` (503.5 MiB, including the existing video-frame assets). See [recovery instructions](Severino-1.0-Checkpoint.md).

## Frontend changes

- Login: split photograph/form panel, compact consent link with the full existing terms dialog, and clearer sign-in/Google/account-creation hierarchy.
- Home: split hero, working category shortcuts, four products loaded from the existing catalog, and a compact brand-story strip. Existing administrator-managed hero imagery, banners, banner dialogs, video stories, featured banners, and Facebook content remain connected.
- Profile: identity/photo panel, order and favorite shortcuts, two desktop columns for personal/delivery information, appearance/security controls, and the existing save/password flows. Country and backup address fields are retained.
- Shop: compact search/filter/sort toolbar, removable filter chips, result count, empty/error recovery, and a remembered Grid/List preference. Both modes use the same catalog, favorites, cart/quantity flow, and inventory updates. Category and search state can be linked through `?category=Women` and `?q=...`.
- Shared customer navigation: olive desktop header, working desktop search, and an accessible tablet menu. Existing mobile menu/quick actions remain available. The draggable scent finder starts near the lower corner for new sessions.

Production changes are confined to frontend components, customer styles, and a local brand image. No backend source, API contracts, database schema, dependency manifests, or deployment configuration were changed. Existing unrelated working files were left in place. The redesign is local and uncommitted for review; the original checkpoint tag has not been pushed to a remote.

## Validation

- Production build: `npm.cmd run build` passed.
- Existing JavaScript unit tests: 36 passed.
- Storefront browser tests: 6 scenarios at each of 320, 390, 768, 1024 and 1440px; all 30 passed. These cover view persistence, combined filtering, sorting, favorites, cart quantities, stock protection, login consent/validation, profile/password payloads, theme choices, retry behavior, navigation, and overflow checks.
- Existing browser regression suite: all 10 scenarios passed across desktop and phone, including administrator-managed banner/video content, the intro, modal scroll/focus behavior, terms, and registration. Its test-only mock fetch transport and stale UI interactions were updated so tests remain isolated from real backend services.
- Browser screenshots were visually reviewed. All browser tests use isolated fixture data rather than live customer accounts or orders.

Run the browser suites with `node tools/test_storefront.mjs` and `node tools/test_frontend.mjs`. They use an installed Microsoft Edge in headless mode and add no application dependencies.

## Review images

Screenshots use sample data only; the application itself still displays catalog and profile data from its existing API.

- [Desktop Home](../tmp/storefront-qa/1440-home.png)
- [Desktop Login](../tmp/storefront-qa/1440-login.png)
- [Desktop Profile](../tmp/storefront-qa/1440-account.png)
- [Desktop Shop Grid](../tmp/storefront-qa/1440-shop.png)
- [Desktop Shop List](../tmp/storefront-qa/1440-list.png)
- [Phone Shop Grid](../tmp/storefront-qa/390-shop.png)
- [Phone Shop List](../tmp/storefront-qa/390-list.png)

## Generated brand image

Saved project asset: `public/images/severino-editorial.webp` (approximately 155 KiB). Generated with the built-in image-generation tool and encoded as WebP for the frontend. It is used in Login and as the default Home brand photo; catalog product images are still supplied by the existing API.

Final generation prompt:

> Use case: product-mockup. Create a premium photographic website brand asset for SEVERINO, a boutique perfume shop. A single rectangular amber glass perfume bottle with black cylindrical cap, warm amber liquid and subtle ivory paper label reading exactly 'SEVERINO' and below in small type 'EAU DE PARFUM'. Bottle resting on light warm limestone, sunlight from upper left, soft olive leaf shadows, a few green leaves entering from top right. Muted warm ivory, sand and deep olive palette. Natural tactile stone surface, photographic glass reflections, soft afternoon studio light, sophisticated understated fragrance editorial, real photographic texture. Landscape 3:2 composition, bottle centered at 62 percent of the width, occupying about 70 percent of frame height; background softly out of focus. Keep entire bottle visible with comfortable edge clearance. This will be cropped to portrait on a login page and to a landscape panel on a home page. No added advertising copy, no badges, no frames, no UI, no watermarks, no decorative text other than the small bottle label. High-quality commercial product photography, warm airy elegant atmosphere.
