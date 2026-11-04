# AdEarn

AdEarn is an editorial publishing platform with a public reading experience and a protected publisher dashboard.

## Features

- Public article feed, categories, search, article pages, sharing, and saved stories.
- Publisher CMS for article creation, editing, drafts, and publishing.
- AI-assisted article drafting and editorial review; generated content remains a draft until a publisher reviews it.
- Newsletter subscriptions, contact inbox, audience management, and analytics.
- Google AdSense configuration with header, in-article, and footer placements.

## Technology

- React, TypeScript, and Vite frontend.
- AppDeploy-managed backend routes, authentication, database, and AI services.
- The backend imports `@appdeploy/sdk` and runs in the compatible AppDeploy-managed runtime. It is **not a standalone Express server**.

## Local frontend development

```bash
npm install
npm run dev
npm run build
```

The managed backend requires an AppDeploy-compatible runtime or a separately implemented backend adapter to run outside AppDeploy.

## Advertising and test mode

Simulation previews are visual placeholders only. They do not create Google ad requests, real impressions, clicks, or revenue. Live AdSense requires an approved AdSense account and site, valid publisher and ad-unit IDs, and compliance with Google's policies. AdEarn does not control which advertisers or creatives Google serves.

## Security

- Never commit passwords, API tokens, private keys, or production environment files.
- Configure production secrets through the deployment environment.
- Publisher routes are protected by authentication and a server-side email allowlist.
- Review all AI-generated content before publication.
