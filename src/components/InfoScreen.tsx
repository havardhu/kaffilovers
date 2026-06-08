import { Card, CardContent, CardHeader } from './ui'

export default function InfoScreen() {
  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 760, margin: '0 auto' }}>
      <Card>
        <CardHeader>
          <h2 style={{ margin: 0 }}>Info for geeks</h2>
          <p style={{ margin: '6px 0 0', color: 'var(--muted-foreground)' }}>
            En liten teknisk omvisning for de nysgjerrige.
          </p>
        </CardHeader>
        <CardContent>
          <h3>Teknologistack</h3>
          <ul>
            <li><strong>Frontend:</strong> Statisk frontend hostet på <a href="https://vercel.com" target="_blank" rel="noreferrer">Vercel</a>.</li>
            <li><strong>Backend:</strong> <a href="https://supabase.com" target="_blank" rel="noreferrer">Supabase</a> med Postgres-database (Row Level Security på alle tabeller), versjonerte SQL-migrasjoner, og <a href="https://deno.com" target="_blank" rel="noreferrer">Deno</a>-baserte edge functions for nødvendig backend-logikk som SMS-sending og kodeverifisering.</li>
            <li><strong>SMS:</strong> En ekstern SMS-tjeneste (<a href="https://sveve.no" target="_blank" rel="noreferrer">Sveve</a>) sender engangskoder.</li>
            <li><strong>Design og utvikling:</strong> Design er laget med <a href="https://claude.ai" target="_blank" rel="noreferrer">Claude Design</a>, og implementasjonen er gjort med <a href="https://claude.com/claude-code" target="_blank" rel="noreferrer">Claude Code</a>.</li>
            <li><strong>Kildekode:</strong> <a href="https://github.com/havardhu/kaffilovers" target="_blank" rel="noreferrer">github.com/havardhu/kaffilovers</a></li>
          </ul>

          <h3 style={{ marginTop: 20 }}>Slik fungerer innloggingen</h3>
          <p>
            Hele backend-stacken er bygget på <strong>Supabase</strong> — en
            open source-plattform som tilbyr Postgres-database, autentisering,
            edge functions og fillagring i én pakke. Supabase støtter SMS-innlogging
            ut av boksen, men bare via internasjonale leverandører (Twilio, MessageBird
            osv.). For å kunne bruke Sveve er det bygget en <em>egen</em> autentiseringsflyt
            oppå Supabase Auth ved hjelp av edge functions og webhooks.
          </p>
          <ol>
            <li>
              <strong>Du taster inn telefonnummer.</strong> Frontend sender nummeret til en
              edge function sammen med en captcha-token.
            </li>
            <li>
              <strong>Edge function genererer en engangskode</strong>, lagrer en hash av
              koden i databasen med utløpstid, og ber SMS-tjenesten sende koden på SMS.
            </li>
            <li>
              <strong>Du taster inn koden.</strong> En annen edge function sjekker hashen mot databasen og — hvis den
              stemmer — utsteder en gyldig Supabase-sesjon (JWT) for kontoen knyttet
              til nummeret. Kontoen opprettes automatisk via en database-trigger
              første gang.
            </li>
            <li>
              <strong>Etter innlogging</strong> snakker frontend rett med Supabase via
              JWT-en. Her kommer <strong>Row Level Security (RLS)</strong> inn:
              RLS er Postgres' innebygde mekanisme for å definere policyer som
              avgjør hvilke rader hver bruker kan lese eller skrive. RLS er
              skrudd på for <em>alle</em> tabeller, og policyene leser{' '}
              <code>auth.uid()</code> fra JWT-en for å sjekke hvem du er. Det
              betyr at sikkerheten er implementert i databasen, og denne begrenser
              tilgang til kun egne bestillinger og data.
            </li>
          </ol>

          <h3 style={{ marginTop: 20 }}>Skills</h3>
          <p>
            Skills er små markdown-filer som forteller agenter hvordan
            de skal håndtere prosjektspesifikke oppgaver. Dette prosjektet har
            én skill foreløpig — for å pushe Supabase migrations:
          </p>
          <details>
            <summary style={{ cursor: 'pointer', fontWeight: 600 }}>supabase — push migrations</summary>
            <pre style={{
              marginTop: 12,
              padding: 12,
              background: 'var(--muted, #f4f4f5)',
              borderRadius: 8,
              overflowX: 'auto',
              fontSize: 12,
              lineHeight: 1.5,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}>{SUPABASE_SKILL}</pre>
          </details>
        </CardContent>
      </Card>
    </div>
  )
}

const SUPABASE_SKILL = `---
name: supabase
description: Manage the Supabase project for CYBER Kaffi Lovers — log in to the CLI, link the local repo to the cloud project, push SQL migrations from \`supabase/migrations/\`, and deploy edge functions from \`supabase/functions/\`. Use when the user says things like "push migrations", "deploy schema", "run the supabase migration", "link supabase", "deploy edge function", or asks to apply changes in \`supabase/migrations/\` or \`supabase/functions/\`.
---

# Supabase CLI — CYBER Kaffi Lovers

This project uses the Supabase CLI via \`npx\` (no global install required). The cloud project ref is **\`xfotwdryjaboowqcdhij\`**. Migrations live in \`supabase/migrations/\` and are applied in filename order.

## Decision flow

1. **Has the user logged in to the Supabase CLI?** Check by running:
   \`\`\`
   npx supabase projects list
   \`\`\`
   If that succeeds, you're logged in. If it errors with "not logged in" or similar, stop and tell the user to run \`npx supabase login\` themselves — it opens a browser, so you cannot do it for them.

2. **Is the project linked?** Check for \`supabase/.temp/project-ref\` or run \`npx supabase status\`. If not linked, run:
   \`\`\`
   npx supabase link --project-ref xfotwdryjaboowqcdhij
   \`\`\`
   This will prompt for the database password. If running non-interactively, ask the user to either run it themselves or supply the password via \`SUPABASE_DB_PASSWORD\` env var.

3. **Push migrations:**
   \`\`\`
   npx supabase db push
   \`\`\`
   This applies every migration in \`supabase/migrations/\` that hasn't been recorded in the cloud project's \`supabase_migrations.schema_migrations\` table. It is idempotent — already-applied files are skipped.

   - If push reports a mismatch ("remote database is not in sync"), do **not** auto-resolve. Show the diff to the user and ask whether to \`db pull\` (accept remote) or \`db push --include-all\` (force-apply local).
   - If a migration fails partway through, the transaction rolls back. Show the user the error verbatim — never edit a migration file that has already been (partially) applied.

## Deploying edge functions

Edge functions live in \`supabase/functions/<name>/index.ts\`. Per-function settings (e.g. \`verify_jwt\`) are pinned in \`supabase/config.toml\` and travel with the deploy.

- **Deploy one function:**
  \`\`\`
  npx supabase functions deploy <name>
  \`\`\`
- **Deploy all functions:**
  \`\`\`
  npx supabase functions deploy
  \`\`\`
- **Function secrets** (env vars like \`SVEVE_USER\`, \`SVEVE_PASSWORD\`, \`SEND_SMS_HOOK_SECRET\`) are set in the dashboard (Project Settings → Edge Functions → Secrets) or via:
  \`\`\`
  npx supabase secrets set KEY=value
  \`\`\`
  Never commit secret values to the repo. The CLI does not pull secrets down; treat the dashboard as the source of truth.
- **Tail logs** while debugging:
  \`\`\`
  npx supabase functions logs <name> --tail
  \`\`\`

Don't forget to deploy after editing — pushing migrations does **not** redeploy functions.

## Creating new migrations

When the user wants to change schema, create a new file rather than editing applied ones:

\`\`\`
npx supabase migration new <descriptive_name>
\`\`\`

This creates \`supabase/migrations/<timestamp>_<name>.sql\`. Edit it, then push.

## Common gotchas

- **Don't edit applied migrations.** Once a migration has been pushed, treat it as immutable. Add a new migration to make further changes.
- **The seed file \`002_seed.sql\` is idempotent** (uses \`on conflict do nothing\`) so re-running it is safe.
- **Auth users are separate from \`public.members\`.** Pushing migrations does not create login accounts — the user must add auth users in Dashboard → Authentication → Users, matching the emails in \`public.members\`. The \`on_auth_user_created\` trigger links them automatically going forward.
- **Resetting the local schema is destructive.** Do not run \`supabase db reset\` against the linked cloud project unless the user explicitly asks — it drops all data.

## Quick reference

| Want to… | Command |
|---|---|
| Log in (one-time, user must do this) | \`npx supabase login\` |
| Link this repo to the cloud project | \`npx supabase link --project-ref xfotwdryjaboowqcdhij\` |
| Apply pending migrations | \`npx supabase db push\` |
| Deploy an edge function | \`npx supabase functions deploy <name>\` |
| Set an edge function secret | \`npx supabase secrets set KEY=value\` |
| Tail edge function logs | \`npx supabase functions logs <name> --tail\` |
| Create a new migration file | \`npx supabase migration new <name>\` |
| See what's pending vs. applied | \`npx supabase migration list\` |
| Pull remote schema into local files | \`npx supabase db pull\` |
| Show CLI / link / login status | \`npx supabase status\` |
`
