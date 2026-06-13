This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Engineering Setup

### 1) Official test command
- `npm test` (alias for `jest --runInBand`)
- `npm run test:ci` (env check + jest, for CI environment)
- `npm run check-env` (fail fast when required env vars are missing)
- `npm run build` (Next.js production build)
- `npx tsc --noEmit` (type-check, required before release)

### 2) Required environment variables
Populate `.env.local` (or `.env`) with at least:
- `DATABASE_URL` (Prisma/PostgreSQL connection string)
- `DIRECT_URL` (service base URL / app local URL)
- `APP_ENCRYPTION_KEY` (cryptographically random secret, required in production)
- `NEXT_PUBLIC_BASE_URL` (public app URL for links/callbacks)

Optionally copy `.env.example` as base.

### 3) Line endings and editor policy
- `.gitattributes` enforces `* text=auto eol=lf`
- `.editorconfig` defines `end_of_line = lf`, `indent_size = 2`
- Windows users:
  - `git config --global core.autocrlf false`
  - `git add --renormalize .`

### 4) Troubleshooting
- Se o CI falhar com variáveis faltando, valide `echo $DATABASE_URL` (ou equivalente). 
- `npm test` deve acionar `jest --runInBand`, não `npm test` indefinido.
- Para re-normalizar CRLF: `git add --renormalize . && git commit -m "Normalize line endings"`.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
