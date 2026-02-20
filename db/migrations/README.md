# Database Migrations

This folder contains two types of SQL files:

## Drizzle-managed migrations (auto-generated)

These are managed automatically by [Drizzle Kit](https://orm.drizzle.team/kit-docs/overview) and tracked in `meta/_journal.json`.
Do **not** edit or rename these files manually.

| File | Description |
|---|---|
| `0000_smooth_doorman.sql` | Initial schema |
| `0001_nasty_madripoor.sql` | Schema updates |
| `0002_shallow_toad_men.sql` | Schema updates |
| `0003_watery_colossus.sql` | Latest Drizzle migration |

## Manual reference migrations (applied outside Drizzle)

These files were applied manually during early development and are kept here as documentation.
They are **not** tracked by Drizzle and should **not** be re-applied on a fresh database — the Drizzle migrations above include their equivalent changes.

| File | Description |
|---|---|
| `0001_perspective_and_findings_rework.sql` | Added perspective field and reworked priority system |
| `0002_add_contract_language.sql` | Added language column to contracts table |

## How to run migrations on a new database

```bash
# Push the current schema to a fresh PostgreSQL database
npm run db:push

# Or apply all Drizzle migrations sequentially
npx drizzle-kit migrate
```
