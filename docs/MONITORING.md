# Bot protection, error tracking and uptime

## Bot check: Cloudflare Turnstile

Used on: register, sign in (page and pop-up), the request form's email code,
re-sending a confirmation code, and password reset. It is invisible for most
people; a checkbox appears only when Cloudflare needs one
(`components/TurnstileField.tsx`). Google sign-in doesn't use it.

- Supabase Auth checks the token itself for sign-up, sign-in, email codes and
  re-sends once captcha is switched on in Supabase.
- Password reset goes through `app/api/auth/recovery`, which checks the token
  with Cloudflare (`lib/turnstile.ts`).
- With no keys set, nothing changes: the widget doesn't render and no token is
  required.

Setup:
1. Cloudflare dashboard > **Turnstile** > Add widget. Hostnames: `vitalapp.in`
   (add `localhost` for testing). Widget mode: **Managed**.
2. Vercel (Production): `NEXT_PUBLIC_TURNSTILE_SITE_KEY` = site key,
   `TURNSTILE_SECRET_KEY` = secret key. Redeploy (the site key is read at build
   time).
3. After that deploy is live: Supabase > Authentication > **Bot and abuse
   protection** > enable CAPTCHA, provider **Turnstile**, paste the secret key.
   (Doing this before step 2 is live would block sign-ups.)

To switch it off in an emergency, turn CAPTCHA off in Supabase; the site keeps
working (tokens are simply ignored). Remove `TURNSTILE_SECRET_KEY` to stop the
password reset check.

Testing keys from Cloudflare: site `1x00000000000000000000AA`, secret
`1x0000000000000000000000000000000AA` (always passes) or
`2x0000000000000000000000000000000AA` (always fails).

## Error tracking: Sentry

Off until a DSN is set. Browser errors go to `/api/monitoring`, which forwards
them only to our Sentry project (keeps the CSP at 'self' and works with tracker
blockers). Server and page-rendering errors are reported from
`instrumentation.ts`.

Privacy (`lib/monitoring.ts`): no IP addresses, cookies, request bodies or user
ids; contact-link tokens, codes, emails and phone numbers are removed from
messages and URLs; no session replay or performance tracing.

Setup:
1. sentry.io > create a project, platform **Next.js**.
2. Copy the project's **DSN** into Vercel as `NEXT_PUBLIC_SENTRY_DSN`
   (Production) and redeploy.
3. Alerts > make sure "new issue" email alerts are on.

## Uptime: Sentry Uptime Monitoring

Sentry > **Uptime** (under Alerts/Insights) > add a monitor:

- URL: `https://vitalapp.in/api/health`
- Method GET, expect status 200

`/api/health` returns `{"ok":true}` only when the app is up and can read from
the database (503 otherwise). Frequent checks also keep the free Supabase
project from pausing.
