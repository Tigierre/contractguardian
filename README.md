# ContractGuardian

![Next.js](https://img.shields.io/badge/Next.js_15-black?style=flat-square&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?style=flat-square&logo=typescript)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?style=flat-square&logo=supabase)
![Railway](https://img.shields.io/badge/Railway-deploy-B53BFF?style=flat-square&logo=railway)
![Docker](https://img.shields.io/badge/Docker-ready-2496ED?style=flat-square&logo=docker)
![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)

**Automated AI-powered contract analysis. Identify legal and business risks before you sign.**

---

## Story

ContractGuardian was born while testing [Tanyra](https://tanyra.io) — a B2B meeting intelligence platform. During analysis of real contract negotiation meetings, a recurring gap emerged: contracts were being discussed without any structured risk review.

ContractGuardian is the validated prototype that solved that problem. It's open source because validating problems publicly is more credible than claiming solutions privately.

---

## What it does

1. **Upload PDF** — drag-and-drop your contract (supports scanned documents via OCR)
2. **Pre-analysis** — AI extracts parties, contract type, and jurisdiction automatically
3. **Validate** — review and correct the extracted metadata before the full analysis
4. **Enhanced analysis** — deep AI analysis enriched with relevant legal norms and citations
5. **Per-actor report** — separate risk breakdown for each party, with severity classification and cited legal references
6. **Export** — download the full report as a PDF

---

## Screenshots

**Home — Upload your contract**
![Home](screenshots/Screen-01.png)

**Step 1 — AI extracts contract metadata automatically**
![Pre-analysis](screenshots/Screen-02.png)

**Step 2 — Validate metadata before running the full analysis**
![Validation](screenshots/Screen-03.png)

**Step 3 — Structured report with findings per actor, severity classification and legal norm citations**
![Report](screenshots/Screen-04.png)

---

## Features

### v1.0 — Core Pipeline
- PDF text extraction (native + OCR fallback via Tesseract.js)
- AI pre-analysis: automatic detection of parties, contract type, jurisdiction
- Interactive metadata validation before running the full analysis
- Full contract analysis with risk findings per article
- Dual-actor report view: separate findings for Party A and Party B
- Severity classification: critical / high / medium / low
- Legal norm citations embedded in findings

### v1.1 — Polish & Export
- PDF report export (pdf-lib)
- Dark mode
- Internationalization: English and Italian (next-intl)
- Analysis history: revisit past analyses
- Improved chunking for long contracts

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 App Router |
| Language | TypeScript (strict) |
| Styling | TailwindCSS v4 |
| ORM | Drizzle ORM |
| Database | Supabase (PostgreSQL) |
| AI | OpenAI GPT-4o-mini |
| PDF generation | pdf-lib |
| OCR | Tesseract.js |
| i18n | next-intl |
| Deploy | Railway |

---

## Infrastructure

ContractGuardian is built with Supabase and Railway as reference providers, but is not locked to them.

- **Database**: any PostgreSQL-compatible provider works (Neon, PlanetScale, self-hosted). Update `DATABASE_URL` accordingly.
- **Hosting**: any platform supporting Next.js standalone builds works (Vercel, Render, Fly.io, self-hosted). Railway config files are included for convenience but are not required.

The only hard dependency is a PostgreSQL database and an OpenAI API key.

---

## Getting Started

### Prerequisites
- Node.js 20+
- A PostgreSQL database ([Supabase](https://supabase.com), [Neon](https://neon.tech), self-hosted, or any compatible provider)
- An [OpenAI](https://platform.openai.com) API key

### Setup

```bash
# 1. Clone the repository
git clone https://github.com/Tigierre/contractguardian.git
cd contractguardian

# 2. Copy the environment template
cp .env.example .env.local

# 3. Fill in the required variables (see .env.example for guidance)
#    - DATABASE_URL     → PostgreSQL connection string
#    - OPENAI_API_KEY   → from platform.openai.com

# 4. Install dependencies
npm install

# 5. Push the database schema
npm run db:push

# 6. Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string (any compatible provider) |
| `OPENAI_API_KEY` | Yes | OpenAI API key (GPT-4o-mini) |
| `NEXT_PUBLIC_APP_URL` | No | Base URL for the app (default: `http://localhost:3000`) |
| `NEXT_PUBLIC_SUPABASE_URL` | No | Supabase project URL (only if using Supabase Auth — not used in v1) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | No | Supabase anon key (only if using Supabase Auth — not used in v1) |

---

## Deploy

ContractGuardian is optimised for [Railway](https://railway.app) with a standalone Next.js build.

The `railway.json` and `railpack.json` configuration files are already included in the repository.

Steps:
1. Create a new Railway project
2. Connect the repository
3. Add the environment variables in the Railway dashboard
4. Railway will auto-detect the build command and deploy

For production, use the **Session pooling** Supabase connection string (port `5432`) in `DATABASE_URL`.

---

## Docker

You can build and run ContractGuardian as a Docker container on any platform.

### Build the image

```bash
docker build -t contractguardian .
```

### Run the container

```bash
docker run -p 3000:3000 \
  -e DATABASE_URL="postgresql://user:password@host:5432/postgres" \
  -e OPENAI_API_KEY="sk-proj-xxx" \
  contractguardian
```

Or pass all variables from a file:

```bash
docker run -p 3000:3000 --env-file .env.local contractguardian
```

The container runs as a non-root user (`nextjs`), listens on port 3000 by default, and reads `PORT` from the environment if you need a different port.

### Migrations on boot

The container entrypoint applies any pending Drizzle migrations from
`./db/migrations` **before** starting the server. This means you do not need
to run `npm run db:migrate` manually after a deploy — point the container at
an empty (or up-to-date) PostgreSQL database and it converges. Applied
migrations are tracked in the `__drizzle_migrations` table, so re-runs are
idempotent.

If you prefer to manage migrations out of band, leave `DATABASE_URL` set but
remove the `./db/migrations` folder from the image; the entrypoint will skip
the step.

### A note on portability

The current implementation is built on **Supabase** (PostgreSQL) and deployed to **Railway**. The Dockerfile and standalone build are provider-agnostic — they work anywhere Docker runs.

It has been tested in production on:
- **Railway** (the original deploy target)
- **Coolify on a self-hosted VPS** (Hetzner) with Traefik forward-auth via Authentik

Migrating to a different infrastructure (e.g. Azure, AWS, GCP) requires adapting the database connection string and, potentially, the storage/auth configuration. The codebase uses standard PostgreSQL via Drizzle ORM, so switching database providers is straightforward as long as the target is PostgreSQL-compatible.

Contributions to improve portability are welcome — open an issue or PR.

---

## Known gotchas when self-hosting

Two issues you may hit when building the Docker image on your own
infrastructure (anything not Railway). Both are fixed in the current
Dockerfile — documented here so future contributors don't re-introduce them.

### 1. `pdf-parse` and Next.js standalone tracing

`pdf-parse@1.x` ships a debug autotest at the top of its `index.js` that
reads `./test/data/05-versions-space.pdf` the first time the module is
required when `module.parent` is falsy. Next.js' standalone output traces
required modules but does **not** copy the test fixture, so at runtime the
package crashes with:

```
Error: ENOENT: no such file or directory, open './test/data/05-versions-space.pdf'
```

The crash bubbles up as an HTML error page from `/api/upload`, and the
client sees `Unexpected token '<', "<!DOCTYPE "... is not valid JSON`.

**Fix:** import the internal file directly, bypassing the autotest:

```ts
// lib/pdf/extractor.ts
const pdfParse = require('pdf-parse/lib/pdf-parse.js'); // ✓
// const pdfParse = require('pdf-parse');                // ✗ crashes
```

### 2. Migrations are not auto-run by Next.js

`next start` (or the standalone `server.js`) does not touch your database
schema. On a fresh deploy this leaves the `contracts` table missing and the
API throws `relation "contracts" does not exist`.

**Fix:** the Dockerfile uses a `docker-entrypoint.sh` that runs
`scripts/migrate.mjs` (a small standalone script using
`drizzle-orm/postgres-js/migrator`) before `exec node server.js`. The
migrations folder and the script are copied into the runner stage
explicitly — the standalone tracer does not include `.sql` files on its own.

---

## Roadmap — v2 ideas

- [ ] Custom analysis policies (define your own risk criteria)
- [ ] Multi-actor support (contracts with more than two parties)
- [ ] User authentication and saved contract library
- [ ] Clause-level redlining and suggested rewrites
- [ ] Webhook support for external integrations

Contributions and ideas welcome — open an issue to discuss.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

---

## License

MIT — see [LICENSE](LICENSE).

---

Built by [Francesco Rossberger](https://tanyra.com) · [francesco.rossberger@gmail.com](mailto:francesco.rossberger@gmail.com) | Spawned from Tanyra validation — [tanyra.com](https://tanyra.com)
