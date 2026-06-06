---
name: supabase
description: Manage the Supabase project for Kaffilauget — log in to the CLI, link the local repo to the cloud project, and push SQL migrations from `supabase/migrations/`. Use when the user says things like "push migrations", "deploy schema", "run the supabase migration", "link supabase", or asks to apply changes in `supabase/migrations/`.
---

# Supabase CLI — Kaffilauget

This project uses the Supabase CLI via `npx` (no global install required). The cloud project ref is **`xfotwdryjaboowqcdhij`**. Migrations live in `supabase/migrations/` and are applied in filename order.

## Decision flow

1. **Has the user logged in to the Supabase CLI?** Check by running:
   ```
   npx supabase projects list
   ```
   If that succeeds, you're logged in. If it errors with "not logged in" or similar, stop and tell the user to run `npx supabase login` themselves — it opens a browser, so you cannot do it for them.

2. **Is the project linked?** Check for `supabase/.temp/project-ref` or run `npx supabase status`. If not linked, run:
   ```
   npx supabase link --project-ref xfotwdryjaboowqcdhij
   ```
   This will prompt for the database password. If running non-interactively, ask the user to either run it themselves or supply the password via `SUPABASE_DB_PASSWORD` env var.

3. **Push migrations:**
   ```
   npx supabase db push
   ```
   This applies every migration in `supabase/migrations/` that hasn't been recorded in the cloud project's `supabase_migrations.schema_migrations` table. It is idempotent — already-applied files are skipped.

   - If push reports a mismatch ("remote database is not in sync"), do **not** auto-resolve. Show the diff to the user and ask whether to `db pull` (accept remote) or `db push --include-all` (force-apply local).
   - If a migration fails partway through, the transaction rolls back. Show the user the error verbatim — never edit a migration file that has already been (partially) applied.

## Creating new migrations

When the user wants to change schema, create a new file rather than editing applied ones:

```
npx supabase migration new <descriptive_name>
```

This creates `supabase/migrations/<timestamp>_<name>.sql`. Edit it, then push.

## Common gotchas

- **Don't edit applied migrations.** Once a migration has been pushed, treat it as immutable. Add a new migration to make further changes.
- **The seed file `002_seed.sql` is idempotent** (uses `on conflict do nothing`) so re-running it is safe.
- **Auth users are separate from `public.members`.** Pushing migrations does not create login accounts — the user must add auth users in Dashboard → Authentication → Users, matching the emails in `public.members`. The `on_auth_user_created` trigger links them automatically going forward.
- **Resetting the local schema is destructive.** Do not run `supabase db reset` against the linked cloud project unless the user explicitly asks — it drops all data.

## Quick reference

| Want to… | Command |
|---|---|
| Log in (one-time, user must do this) | `npx supabase login` |
| Link this repo to the cloud project | `npx supabase link --project-ref xfotwdryjaboowqcdhij` |
| Apply pending migrations | `npx supabase db push` |
| Create a new migration file | `npx supabase migration new <name>` |
| See what's pending vs. applied | `npx supabase migration list` |
| Pull remote schema into local files | `npx supabase db pull` |
| Show CLI / link / login status | `npx supabase status` |
