# Lucy Portal

Lucy Portal is the public website of the Lucy Robotics project. It presents the project, guides users through installing the Lucy workspace, and publishes the project roadmap and blog. Authenticated maintainers can edit roadmap items and blog posts directly from the portal, using Keycloak single sign-on.

Live demo: <https://demo.lucy-robotics.com/> | Documentation: <https://docs.lucy-robotics.com/share/p1x9ikjkhf/p/public-documentation-EExgMX2REV> | Community: [Discord](https://discord.gg/g4KNZ3eeBd)

## Requirements

- **Node.js** `^20.19.0` or `>=22.12.0` (required by Vite 8)
- **npm** 10 or later (comes with Node.js)
- **Git**

Optional, depending on which features you need:

- A running instance of the **Lucy backend API**, which provides the roadmap and blog content (see [Backend API](#backend-api)).
- A **Keycloak** realm with a confidential OpenID Connect client, for admin sign-in (see [Authentication](#authentication)).

## Getting started

```bash
# 1. Clone the repository
git clone git@github.com:Lucy-Robotics/lucy-portal.git
cd lucy-portal

# 2. Install dependencies
npm ci

# 3. Create your local configuration
cp .env.example .env

# 4. Start the development server
npm run dev
```

The portal is then available at `http://localhost:<PORT>`. With the provided `.env.example`, that is `http://localhost:5173`.

Leave `BACKEND_URL` and the `KEYCLOAK_*` variables empty to work on the static pages only. The browser console then warns that the blog, the roadmap and admin sign-in are disabled.

## Configuration

Configuration is read from a `.env` file at the project root (or from the process environment). The variables do **not** use the `VITE_` prefix. `vite.config.ts` loads them explicitly and injects only the public ones into the client bundle.

| Variable                 | Required | Used by               | Description                                                                                                  |
|--------------------------|----------|-----------------------|--------------------------------------------------------------------------------------------------------------|
| `PORT`                   | No       | Dev / preview server  | Port the Vite server (`npm run dev`, `npm start`) listens on. Defaults to `5000`.                            |
| `VITE_ALLOWED_HOST`      | No       | Dev / preview server  | Comma-separated list of additional host names accepted by the Vite server (for example, behind a tunnel).   |
| `BACKEND_URL`            | No       | Client bundle         | Base URL of the backend API. Without it, the blog and roadmap are disabled.                                  |
| `KEYCLOAK_URL`           | No       | Client bundle         | Base URL of the Keycloak server, for example `https://auth.example.com`.                                     |
| `KEYCLOAK_REALM`         | No       | Client bundle         | Keycloak realm name.                                                                                         |
| `KEYCLOAK_CLIENT_ID`     | No       | Client bundle         | Client ID of the portal in Keycloak.                                                                         |
| `KEYCLOAK_CLIENT_SECRET` | No       | Dev / preview server  | Client secret, used by the token proxy of `npm run dev` and `npm start`. Never injected into the client bundle. |

Important notes:

- **Values are baked in at build time.** `BACKEND_URL` and the public `KEYCLOAK_*` values are inlined into the JavaScript bundle by `npm run build`. Rebuild after changing any of them.
- **Admin sign-in is enabled only** when `KEYCLOAK_URL`, `KEYCLOAK_REALM` and `KEYCLOAK_CLIENT_ID` are set, and either the dev server is used or `BACKEND_URL` is set (see `src/config/env.ts`).
- **Never commit `.env`.** It is already listed in `.gitignore`.

## Available scripts

| Command           | Description                                                          |
|-------------------|----------------------------------------------------------------------|
| `npm run dev`     | Starts the Vite development server with hot module replacement.      |
| `npm run build`   | Type-checks the project (`tsc -b`) and builds it into `dist/`.       |
| `npm run preview` | Serves the content of `dist/` locally, to check a production build.  |
| `npm start`       | Serves `dist/` (`vite preview`) in production, with the token proxy. |
| `npm run lint`    | Lints the source code with Oxlint.                                   |

## Authentication

The portal signs maintainers in with OpenID Connect against Keycloak, using the authorization code flow. The Keycloak client is **confidential**, so the client secret is needed to exchange the authorization code for tokens. The browser must never see the secret, so token requests go through a server-side proxy that adds it:

| Environment | Token endpoint used by the browser | Provided by                                                        |
|-------------|------------------------------------|--------------------------------------------------------------------|
| Development | `<portal origin>/api/auth/token`   | `vite-plugin-keycloak-token-proxy.ts` (reads `KEYCLOAK_CLIENT_SECRET`) |
| Production (`npm start`, build with the secret) | `<portal origin>/api/auth/token` | The same proxy, run by `vite preview` |
| Production (otherwise) | `<BACKEND_URL>/auth/token`         | The backend (see `backend/auth-token.example.ts`)                  |

### Keycloak client settings

Create an OpenID Connect client in your realm with **Client authentication** enabled and the **Standard flow** enabled. Then set the following values, replacing `https://portal.example.com` with the portal origin. In development, the origin is `http://localhost:<PORT>`.

| Keycloak setting                  | Value                                                  |
|-----------------------------------|--------------------------------------------------------|
| Valid redirect URIs               | `https://portal.example.com/auth/callback`             |
| Valid post logout redirect URIs   | `https://portal.example.com/`                          |
| Web origins                       | `https://portal.example.com`                           |
| Front channel logout URL          | `https://portal.example.com/auth/front-channel-logout` |

Authenticated requests send the Keycloak access token in the `X-Auth-Token` header. The request and response types are defined in `src/types/`, and the client is in `src/lib/api.ts`.

## Deployment

The portal builds to a static single-page application, so any static web server or CDN can host it.

### 1. Build

Set the production configuration, either in a `.env` file or in the CI environment, then build:

```bash
npm ci
npm run build
```

The output is written to `dist/`. Set `KEYCLOAK_CLIENT_SECRET` only if `npm start` serves the build and proxies sign-in (the bundle then only knows a proxy exists, never the secret). Otherwise leave it unset: the backend proxies sign-in.

The simplest way to serve it is `npm start` (`vite preview`) on `PORT`. Behind a domain name, list it in `VITE_ALLOWED_HOST`. Hashed files under `/assets` are cached for good. To use another web server instead, see below.

### 2. Serve with a single-page application fallback

Routing happens on the client side, so every unknown path must serve `index.html`. Otherwise, direct links such as `/blog/42` or `/auth/callback` return a 404 error.

Example Nginx configuration:

```nginx
server {
    listen 80;
    server_name portal.example.com;

    root /var/www/lucy-portal/dist;
    index index.html;

    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

Terminate TLS in front of this server, for example with Certbot or a reverse proxy. Other hosts need an equivalent rewrite rule, for example `_redirects` on Netlify or `rewrites` in `vercel.json`.

### 3. Configure the backend

- Expose `POST /auth/token`, which forwards the form-encoded body to the Keycloak token endpoint and adds `client_secret`. `backend/auth-token.example.ts` is a ready-to-adapt Express implementation. With Express, mount it after `express.urlencoded()`.
- Allow the portal origin in CORS, including the `Content-Type` and `X-Auth-Token` request headers and the `GET`, `POST`, `PUT` and `DELETE` methods.
- Serve the API over HTTPS on the same scheme as the portal, to avoid mixed-content errors.

## License

Lucy Portal is free software, licensed under the **GNU General Public License v3.0**. See the [LICENSE](LICENSE) file for the full text.

Copyright (C) Lucy Robotics and contributors.
