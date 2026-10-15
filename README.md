# The Last Patient — Halloween murder mystery

A compact, mobile-first Next.js + Supabase game for a one-time office event. It includes employee photo selection, persistent progress, secure session cookies, recovery codes for a different browser context, four ordered clue QR codes, a four-choice illusion finale, a race-safe single winner, and a password-protected QR PNG generator.

## Simplifications made

- Exactly **four printed QR codes**, one for each physical clue. Players start at the website URL directly; after Clue 4, the final four-choice illusion selection appears automatically. There is no separate START or FINAL QR.
- No admin dashboard, accounts, payment services, upload UI, or paid APIs. Employee records are loaded directly into Supabase before the event.
- One event only. The SQL schema enforces a single winner. To run another event, follow the reset procedure below.
- The app uses Supabase's service-role key only on the server. Do not prefix it with `NEXT_PUBLIC_` or expose it in browser code.

## Requirements

- Node.js 20.9+ (Node 22 recommended)
- A free Supabase project
- A Vercel account or another Node-compatible host

## 1. Create Supabase project and schema

1. Create a project at [Supabase](https://supabase.com/).
2. Open **SQL Editor → New query**.
3. Paste and run `supabase/schema.sql`.
4. In **Project Settings → API**, copy the Project URL and `service_role` key. Keep the service-role key private.

### Add employee profiles

In Supabase **Table Editor → employees → Insert row**, add each employee:

- `name`: employee's full display name
- `photo_url`: a publicly accessible image URL, or `null`
- `active`: `true`

The UUID is generated automatically. You can upload images to a Supabase Storage bucket and paste their public URLs into `photo_url`. Use employee photos only with permission. Since photos are public URLs in the player selection grid, do not store private or sensitive images there.

Example SQL (replace names and image URLs):

```sql
insert into public.employees (name, photo_url, active) values
('Alex Morgan', 'https://your-image-host.example/alex.jpg', true),
('Jamie Silva', 'https://your-image-host.example/jamie.jpg', true);
```

Do not insert real employee data into a public repository.

## 2. Configure and run locally

```bash
cp .env.example .env.local
```

Set these values in `.env.local`:

- `NEXT_PUBLIC_SUPABASE_URL`: your Supabase Project URL
- `SUPABASE_SERVICE_ROLE_KEY`: your server-only service-role key
- `NEXT_PUBLIC_SITE_URL`: `http://localhost:3000` for local development
- `QR_ADMIN_PASSWORD`: a long private password for the QR generator
- `COOKIE_SECURE`: `false` locally

Install and run:

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. Localhost is only for testing. Do not print QR codes generated with localhost URLs.

## 3. Deploy to Vercel

1. Push the project to a private Git repository.
2. Import it into [Vercel](https://vercel.com/).
3. Add all environment variables in **Project Settings → Environment Variables**.
4. Set `NEXT_PUBLIC_SITE_URL` to the final HTTPS production origin, e.g. `https://your-game.vercel.app` or your custom domain, without a trailing slash.
5. Set `COOKIE_SECURE=true`.
6. Deploy and test the deployed URL on real phones.
7. If changing environment variables, redeploy for them to take effect.

Use a hosting plan whose terms cover your event's expected usage. The free tiers and terms can change; confirm current limits before the event.

## 4. Generate the four production QR codes

1. After deployment, set `NEXT_PUBLIC_SITE_URL` to the deployed HTTPS URL and redeploy.
2. Visit `https://YOUR-DOMAIN/qr-generator`.
3. Enter `QR_ADMIN_PASSWORD` and unlock the QR archive.
4. Download the four high-resolution PNGs and print one at each physical clue location.
5. Scan every printed code with a normal phone camera before the event.

QR destinations:

- Clue 1: `/?clue=1`
- Clue 2: `/?clue=2`
- Clue 3: `/?clue=3`
- Clue 4: `/?clue=4`

The QR codes contain only the public website URL and clue number. They contain no employee information or session tokens.

## 5. How the game works

- The player opens the base site and selects their preloaded employee profile.
- A cryptographically random session token is set in an HttpOnly cookie; only its SHA-256 hash is stored in the database.
- A one-time recovery code is shown after starting. Players should save it. If their camera opens a different browser context, they can select their profile, choose **Resume My Investigation**, and enter the code. Employee name alone is never sufficient to resume.
- Each QR opens the same page. The server checks the cookie, active session, and clue order; PostgreSQL records each clue idempotently.
- After all four clues, the final illusion-selection screen appears with four fictional suspect figures. Every option is accepted; there is no correct answer. The first player to submit a valid selection claims the unique winner row atomically in PostgreSQL and sees their own preloaded employee photo with the reveal that they were the killer and the last patient.
- The phone's clock is not used to select the winner; PostgreSQL timestamps the successful claim.

## 7. Reset for a new event

This is intended for one game run. A reset removes all sessions, progress, and winner data but keeps employee records. Only run it when no players are active:

```sql
begin;
truncate table public.game_winners, public.clue_progress, public.game_sessions restart identity;
commit;
```

The `restart identity` clause is harmless here; UUIDs are regenerated. Never expose a public reset API. If you run a new event, rotate the QR admin password as appropriate.

## 8. Test checklist

- [ ] Employee list shows only active profiles and photographs load on mobile.
- [ ] Starting creates one session and shows a recovery code.
- [ ] Refresh and fully closing/reopening the same browser restores the session.
- [ ] Scan Clue 1, then close the browser and scan Clue 2 with the normal camera; progress shows 2/4.
- [ ] Re-scan Clue 2; there is still only one database row for it.
- [ ] Scan Clue 4 before Clue 3; the server rejects it.
- [ ] Complete Clues 3 and 4; the four illusion suspects appear.
- [ ] All four illusion choices are accepted after completing all four clues.
- [ ] The chosen illusion does not affect the outcome; winner reveal displays the player's preloaded photo and server timestamp.
- [ ] A second player finishing afterwards sees that the case is closed and cannot become winner.
- [ ] Use the recovery code in another browser context to resume the same session.
- [ ] Scan every printed QR on both iOS and Android camera apps.

## Browser and event-day limitations

The normal camera typically opens the URL in the same default browser, where the cookie survives closing the browser. If it opens an in-app browser, private tab, or a different browser app, cookies are not shared. The recovery code is the fallback. Do not ask players to use incognito/private browsing.

## Security notes

- The service-role key is server-only. RLS is enabled and client roles have no table access.
- The session cookie is HttpOnly, SameSite=Lax and becomes Secure when `COOKIE_SECURE=true`.
- The QR generator requires the configured password on each PNG request. Keep the password private and change it after the event.
- Final-stage submissions are rate-limited in process memory. On serverless deployments, memory-based limits are best-effort and may reset between instances; for a single short office event this is a lightweight deterrent, not a globally distributed rate limiter.
- Supabase service-role access bypasses RLS by design, so API routes must continue validating session ownership as implemented.
- Use employee photos only with permission and avoid storing unnecessary personal information.

## Project structure

```text
app/
  api/register/route.ts   # employee list + start session
  api/state/route.ts      # restore cookie session and progress
  api/clue/route.ts       # validate and record ordered clues
  api/resume/route.ts     # recovery-code resumption
  api/answer/route.ts     # validates illusion choice + winner claim
  api/qr/route.ts         # protected PNG QR generator
  qr-generator/page.tsx   # minimal password-protected QR utility
  page.tsx                # single-page player experience
  globals.css             # responsive asylum theme
lib/
  session.ts              # token hashing and secure cookie
  supabase.ts             # server-only Supabase client
supabase/schema.sql       # tables, RLS, and atomic PostgreSQL functions
```
