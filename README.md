# Find Museum Gallery

A batteries-included Next.js 14 starter configured with TypeScript, Tailwind CSS, shadcn/ui, and Recharts. Use it as the foundation for modern web applications with a great developer experience.

## Getting Started

Install dependencies:

```bash
npm install
```

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the application.

## Available Scripts

- `npm run dev` – Starts the Next.js development server.
- `npm run build` – Builds the application for production.
- `npm run start` – Runs the production build.
- `npm run lint` – Runs ESLint using the Next.js configuration.

## Tech Stack

- [Next.js 14](https://nextjs.org/) App Router with TypeScript
- [Tailwind CSS](https://tailwindcss.com/) with custom theme tokens and dark mode support
- [shadcn/ui](https://ui.shadcn.com/) component utilities configured via `components.json`
- [Recharts](https://recharts.org/en-US/) for data visualizations
- Path aliases configured with `@/*` for simpler imports

## Project Structure

```
.
├── components.json
├── next.config.mjs
├── package.json
├── postcss.config.mjs
├── tailwind.config.ts
├── tsconfig.json
└── src
    ├── app
    │   ├── globals.css
    │   ├── layout.tsx
    │   └── page.tsx
    ├── components
    │   └── ui
    │       ├── button.tsx
    │       └── card.tsx
    └── lib
        └── utils.ts
```

## shadcn/ui Components

The project includes foundational shadcn/ui utilities (`Button`, `Card`, and `cn` helper) so you can immediately compose interfaces. Additional components can be generated using the [shadcn/ui CLI](https://ui.shadcn.com/docs/installation) with the included `components.json` configuration.

## Tailwind Theme

Global styles (`src/app/globals.css`) define CSS variables for light and dark themes. Tailwind is configured with a centered container and animation utilities to support shadcn/ui components out of the box.

## Charting with Recharts

The home page (`src/app/page.tsx`) renders an interactive area chart to verify that Recharts works with the Next.js App Router and Tailwind styling.

## Supabase Regional Metadata

To enable region-based filtering you will need to run the SQL migration and optional backfill script included in this repository.

### 1. Apply the migration

Run the migration SQL against your Supabase project (CLI or dashboard):

```bash
# using the Supabase CLI
supabase db remote commit supabase/migrations/20251111_add_regions_schema.sql

# or copy/paste the SQL file into the Supabase SQL editor and execute it
```

This creates the `regions` lookup table, adds the `region_id` column to `museum-gallery-db`, and installs an `updated_at` trigger.

### 2. Backfill regions

Set the required environment variables so the script can use your service role key:

```bash
export NEXT_PUBLIC_SUPABASE_URL="https://your-project-id.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
```

Then run the seed script (requires [tsx](https://github.com/privatenumber/tsx) or another TS runner – you can `npx tsx` without an install):

```bash
npx tsx scripts/seed/seed-regions.ts
```

The script will:

- Derive region names from `address_road` / `address_jb` tokens.
- Insert any new regions (stored in the `regions` table).
- Update `museum-gallery-db.region_id` for matched museums.
- Log unmatched addresses to `scripts/seed/region-unmatched.json` so you can add overrides inside `scripts/seed/region-overrides.json` and re-run.

### 3. API endpoints

- `GET /api/regions` returns the list of regions with museum counts.
- `GET /api/museums?region=<slug>` filters museums by region slug or UUID.

After running the migration and seed script, restart the dev server to pick up any new environment variables.

## License

This project is provided as-is without any specific license.
