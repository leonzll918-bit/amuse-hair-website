# Amuse Hair Studio — Cloudflare Deployment

This repository contains both the public Amuse Hair Studio website and repository-level AI/Codex resources.

AI resources remain committed to GitHub for Codex use, but they are not production website assets and must never be included in the public Cloudflare artifact.

## Deployment Platform

Verified production configuration as of 2026-10-03:

- Platform: Cloudflare Workers Builds
- Worker name: `amuse-hair-website`
- Git repository: `leonzll918-bit/amuse-hair-website`
- Production branch: `main`
- Root directory: `/`
- Build command: `node scripts/build-site.cjs`
- Deploy command: `npx wrangler deploy`
- Static assets directory: `./dist`

The static assets directory is defined in `wrangler.jsonc`.

## Production Build

Run from the repository root:

```text
node scripts/build-site.cjs
```

The build script creates:

```text
dist/
```

`dist/` is the complete public website artifact.

The script uses only Node.js built-ins. No npm install, framework, package manifest, or additional dependency is required.

The build script copies an explicit list of public website files without transforming their contents.

## Deployment Isolation

The repository contains development and AI resources that must not be published as website assets.

These include:

```text
.agents/**
skills-lock.json
DEPLOYMENT.md
scripts/**
.git/**
```

Cloudflare must publish only the files generated inside:

```text
dist/
```

The generated `dist/` directory is excluded from Git through `.gitignore`.

The Wrangler configuration must continue to point static assets only to:

```text
./dist
```

Do not change the deployment to publish the repository root.

## Wrangler Configuration

`wrangler.jsonc` identifies the existing Worker and production asset directory.

Expected configuration:

```json
{
  "name": "amuse-hair-website",
  "compatibility_date": "2026-10-03",
  "assets": {
    "directory": "./dist"
  }
}
```

This website is static. No Worker script is currently required.

## Cloudflare Workers Builds Settings

Cloudflare Dashboard → Worker `amuse-hair-website` → Settings → Build

Required production settings:

```text
Production branch:
main

Root directory:
/

Build command:
node scripts/build-site.cjs

Deploy command:
npx wrangler deploy
```

The build therefore runs:

```text
GitHub main
    ↓
node scripts/build-site.cjs
    ↓
dist/
    ↓
npx wrangler deploy
    ↓
Cloudflare Workers Static Assets
```

Only `dist/` is configured as the static asset collection.

## Build Watch Paths

Cloudflare Workers Builds should use:

```text
Include paths:
*

Exclude paths:
.agents/*
skills-lock.json
```

This prevents changes limited to Codex skills or the skill lockfile from unnecessarily triggering a website build.

If a push also contains a normal website or deployment file change, the build should still run.

Build Watch Paths are an optimization only. Production isolation is enforced by generating an explicit `dist/` artifact and configuring Wrangler to deploy only that asset directory.

## Public Website Files

The production build currently contains 18 public files, including 12 HTML pages.

The existing English and Chinese website structure is preserved, including the English and Chinese Hair Colour service pages.

Existing website source files, URL paths, CSS, JavaScript, GA4 tracking, WhatsApp click tracking, sitemap, navigation, service dialogs, and gallery behavior must not be modified by the deployment-isolation process.

When adding a new public page or local asset in the future, also add it to the explicit public-file list in:

```text
scripts/build-site.cjs
```

Otherwise it will not be copied into `dist/` and therefore will not be deployed.

## Local Validation

Before deployment, run:

```text
node scripts/build-site.cjs
```

Confirm that:

- the build completes successfully;
- `dist/` contains only intended public website files;
- all expected HTML pages are present;
- `.agents/` is absent;
- `skills-lock.json` is absent;
- existing website source files remain unchanged.

## Deployment Safety

Do not commit generated `dist/` files.

Do not publish the repository root.

Do not change the Worker name without verifying the existing Cloudflare Worker.

Do not change the production branch from `main` without intentionally changing the deployment architecture.

Repository-level AI/Codex resources may remain committed to GitHub. They are separated from the public website by the explicit production build and Wrangler static-assets configuration.