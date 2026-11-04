# AdEarn

AdEarn is an editorial publishing and advertising platform with a public reading experience and a protected publisher dashboard.

## Features

- Public article feed, categories, search, article pages, sharing, and locally saved stories.
- Publisher CMS for creating, editing, drafting, publishing, and deleting articles.
- AI Studio powered by Neon AI Gateway for article drafting and editorial/SEO review. AI output is never auto-published.
- Newsletter subscriptions, contact inbox, audience management, and daily page-view analytics.
- Google AdSense settings with header, in-article, and footer placements.
- Clearly labelled advertising simulation mode; simulations do not generate real ad requests, impressions, clicks, or revenue.

## Architecture

- React, TypeScript, Vite, and Lucide icons.
- Vercel Node.js serverless API in `api/[...path].ts`.
- Neon PostgreSQL for articles, newsletter subscribers, contact messages, analytics, and site settings.
- Neon Managed Better Auth for email/password sessions and JWTs.
- Neon AI Gateway for the editorial assistant.
- GitHub `main` branch connected to the Vercel project.

The browser never receives the database connection string or the AI Gateway credential. Admin API requests send a short-lived Neon Auth JWT; the server verifies it against Neon JWKS and checks the configured email allowlist.

## Environment variables

Configure these in Vercel Project Settings → Environment Variables. Never commit real values.

| Variable | Visibility | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Server-only secret | Neon PostgreSQL connection |
| `NEON_AUTH_BASE_URL` | Server | Neon Managed Auth endpoint |
| `NEON_AUTH_JWKS_URL` | Server | JWKS endpoint for JWT verification |
| `VITE_NEON_AUTH_URL` | Public | Browser Neon Auth endpoint |
| `ADMIN_EMAILS` | Server-only secret | Comma-separated admin email allowlist |
| `NEON_AI_GATEWAY_TOKEN` | Server-only secret | Neon credential scoped to `ai_gateway:invoke` |
| `NEON_AI_GATEWAY_BASE_URL` | Server | Branch-specific Neon AI Gateway host |
| `AI_MODEL` | Server | Default model name (currently `gpt-5-mini`) |

## Local development

1. Copy `.env.example` to `.env.local` and fill values from your own Neon/Vercel project.
2. Run `npm install`.
3. Run `npm run dev` for the Vite frontend.
4. Run `npm run build` to type-check and build the frontend.

The Vercel API routes require the Vercel runtime. Use `vercel dev` to run frontend and API together locally after linking the project and pulling environment variables with the Vercel CLI.

## Administrator setup

1. Open the site's Admin page.
2. Create an account using an email address present in `ADMIN_EMAILS`.
3. Verify the email if Neon Auth requests verification, then sign in.
4. The API independently enforces the email allowlist; merely registering an account does not grant admin access.

## API routes

- Public: `GET /api/health`, `GET /api/articles`, `GET /api/public-config`, `POST /api/newsletter`, `POST /api/contact`, `POST /api/analytics/pageview`.
- Admin (Neon Auth JWT + allowlist): `/api/admin/overview`, `/api/admin/articles`, `/api/admin/settings`, `/api/admin/subscribers`, `/api/admin/messages`, `/api/admin/ai/article-draft`, `/api/admin/ai/optimize`.

## Advertising compliance

Simulation previews are visual placeholders only. They do not create Google ad requests, real impressions, clicks, or revenue. Live AdSense requires an approved AdSense account and site, valid publisher and ad-unit IDs, and compliance with Google's policies. Google controls advertiser selection and the actual creatives served. Never click your own ads or encourage others to do so.

## Security and operations

- Never commit passwords, API tokens, private keys, or production environment files.
- Keep database and AI Gateway credentials server-side and encrypted in Vercel.
- Admin routes verify signed JWTs on the server; frontend visibility is not an authorization boundary.
- Validate and review all user-submitted and AI-generated content before publication.
- Use a preview Neon branch for schema changes and test migrations before applying them to production.
