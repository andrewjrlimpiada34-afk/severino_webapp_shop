# React + Vite

## Deployment output

Vercel runs `npm run build` and publishes only `dist/`, as configured in
`vercel.json`. Public assets are copied by `build/publicAssets.js` so disabled
features do not add unused media to every deployment.

The homepage scroll video is controlled by `SHOW_HOME_SCROLL_VIDEO` in
`src/config/storefrontFeatures.js`. While it is `false`, production builds omit
`public/desktop_homevideo/` and `public/mobile_homevideo/` (4,800 JPEG frames).
The original files remain in the repository and stay available to the local dev
server. Setting the shared flag to `true` includes both folders again.

This reduces the current build output from approximately 574 MiB to 2.36 MiB.
It affects new deployments; existing Vercel deployment history still requires
cleanup or a shorter [deployment retention policy](https://vercel.com/docs/deployment-retention).

Validate the asset-copy rules with `node --test build/publicAssets.test.js`.

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
# Python OTP service

OTP delivery and verification use a separate Python service with Gmail API.
Follow [the OTP setup guide](server/otp_service/README.md) before deploying the
backend changes. The existing frontend routes and layout remain unchanged.
