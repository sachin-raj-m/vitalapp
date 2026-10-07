# Staging environment

A separate Supabase project with fake data, used to QA things that cannot be
tested safely on production: the RLS lockdown against a live API, the guest
email-code request flow (which emails real donors on production), the donor
PIN flow, and account deletion.

Nothing here touches production. Production's project ref, keys and SMTP
credentials must never be used in any step below.

Before you start, the database rules can be checked locally with no Supabase
project at all:

```bash
npm run test:rls          # throwaway local Postgres, ~2 s, needs Homebrew postgresql
```

## 1. Create the staging project

1. In the Supabase dashboard, **New project** in the same organisation:
   name `vital-staging`, free plan, same region as production, a new strong
   database password (store it in the team password manager).
2. Note the **project ref** (`https://<staging-ref>.supabase.co`) and, from
   **Project Settings > API**, the `anon` and `service_role` keys.
3. From **Connect > Session pooler**, copy the connection string and keep it in
   your shell only:

   ```bash
   export STAGING_REF=<staging-ref>
   export STAGING_DB_URL='postgresql://postgres.<staging-ref>:<db-password>@aws-0-<region>.pooler.supabase.com:5432/postgres'
   ```

## 2. Apply the migrations

The repo's `supabase/.temp` is linked to production. Pushing with an explicit
`--db-url` avoids relinking and the risk of a later command hitting the wrong
project:

```bash
supabase db push --db-url "$STAGING_DB_URL"
```

If you prefer linking, do it explicitly and **relink production afterwards**:

```bash
supabase link --project-ref "$STAGING_REF"
supabase db push
# ...when done:
supabase link --project-ref <prod-ref>
```

Check it worked: **Database > Tables** shows `profiles`, `blood_requests`,
`donations`, `donor_secrets`, `request_contacts`, `rate_limits`, and **Storage**
shows a private `proofs` bucket.

## 3. Seed fake data

```bash
psql "$STAGING_DB_URL" -v ON_ERROR_STOP=1 -f supabase/seed.staging.sql
```

(Or paste the file into the staging **SQL editor**.) It is safe to re-run; it
resets only its own fixture rows. It refuses to run on a database with more
than 25 non-`example.com` users, as a guard against pointing it at production.

What you get, all in the made-up city **Testville**:

| Account (password `VitalStaging-2026!`) | Role | Blood group | Donor PIN | Notes |
|---|---|---|---|---|
| `staging-admin@example.com` | admin | | | |
| `staging-req1@example.com` | requester | | | owns open O- (2 units) and A+ requests; the A+ one has a pending offer from Chitra |
| `staging-req2@example.com` | requester | | | owns open B+ (3 units), fulfilled AB+, and an **Otherville** O- request |
| `staging-donor-opos@example.com` | donor, public card | O+ | 1111 | |
| `staging-donor-oneg@example.com` | donor, private | O- | 2222 | |
| `staging-donor-apos@example.com` | donor, private | A+ | 3333 | pending offer on req1's A+ request |
| `staging-donor-aneg@example.com` | donor, public card | A- | 4444 | |
| `staging-donor-bpos@example.com` | donor, private | B+ | 5555 | |
| `staging-donor-abpos@example.com` | donor, public card | AB+ | 6666 | completed donation on the fulfilled request |
| `staging-donor-away@example.com` | donor, **unavailable** | O- | 7777 | must never be alerted |
| `staging-donor-other@example.com` | donor in **Otherville** | O- | 8888 | must not be alerted for Testville |
| `staging-donor-nopin@example.com` | donor | B- | none | for the "set your PIN" prompt |

Every email is `@example.com` (reserved, never delivered) and every phone
starts with `00000`.

## 4. Auth settings

Copy these from production's **Authentication** settings, changing only the
URLs and SMTP.

| Setting | Staging value |
|---|---|
| Site URL | the staging preview URL (step 5), e.g. `https://vitalapp-git-dev-<team>.vercel.app` |
| Redirect URLs | `http://localhost:3000/**`, `https://*-<team>.vercel.app/**` |
| Email provider | enabled, **Confirm email** on |
| Email OTP length / expiry | same as production (6 digits) |
| Minimum password length | **8** |
| Google provider | optional: needs the staging callback `https://<staging-ref>.supabase.co/auth/v1/callback` added to a Google OAuth client. Skip unless testing Google sign-in. |
| SMTP | a **sandbox** inbox (e.g. Mailtrap "Email Testing"), not production's SMTP. Every email the staging project sends lands there, whatever the recipient. |
| Rate limits > emails per hour | raise to ~100 once custom SMTP is on (the built-in mailer allows only a few per hour, and only to team members) |

**Email templates** (the app's guest flow and sign-in use a 6-digit code, so
the code must be in the email):

- **Magic Link**: subject `Your Vital sign-in code`, body containing
  `{{ .Token }}` (copy production's template).
- **Confirm signup**: also include `{{ .Token }}`. A brand-new email address
  going through the guest request form gets *this* template, not Magic Link,
  so without the token the guest can't finish. Step 6B tests exactly this.

To copy production's auth config exactly instead of by hand (needs a personal
access token from **Account > Access tokens**):

```bash
export SUPABASE_ACCESS_TOKEN=sbp_...
curl -s "https://api.supabase.com/v1/projects/<prod-ref>/config/auth" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
| jq '{password_min_length, password_required_characters, mailer_otp_length, mailer_otp_exp,
       mailer_subjects_magic_link, mailer_templates_magic_link_content,
       mailer_subjects_confirmation, mailer_templates_confirmation_content,
       mailer_autoconfirm, external_email_enabled}' > /tmp/auth-staging.json
# review /tmp/auth-staging.json, then:
curl -s -X PATCH "https://api.supabase.com/v1/projects/$STAGING_REF/config/auth" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -H "Content-Type: application/json" \
  -d @/tmp/auth-staging.json
```

Set `site_url`, `uri_allow_list` and `smtp_*` for staging separately; never
copy production's SMTP password.

## 5. Vercel preview environment

In **Vercel > Project > Settings > Environment Variables**, add these with
scope **Preview** only (optionally limited to the `dev` branch). Do not edit the
Production values.

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<staging-ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | staging `anon` key |
| `SUPABASE_SERVICE_ROLE_KEY` | staging `service_role` key (server only, never `NEXT_PUBLIC_`) |
| `NEXT_PUBLIC_SITE_URL` | the stable branch URL, e.g. `https://vitalapp-git-dev-<team>.vercel.app` |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | the same sandbox inbox as step 4 (donor alerts and welcome emails) |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | a **new** pair: `npx web-push generate-vapid-keys` |
| `VAPID_SUBJECT` | `mailto:<team address>` |

`NEXT_PUBLIC_*` values are baked in at build time: **redeploy** the preview
after changing them. Confirm the preview is on staging by checking the
browser's Network tab: Supabase calls go to `<staging-ref>.supabase.co`.

For local runs against staging, put the same values in `.env.local` (git
ignored), not `.env`.

## 6. QA retest checklist

Set these in your shell for the curl checks:

```bash
export URL=https://<staging-ref>.supabase.co
export ANON=<staging anon key>
alias sb='curl -s -H "apikey: $ANON"'
```

### A. RLS against the live API (closes "RLS lockdown not independently verified")

Signed out (anon key only). PostgREST answers a privilege error with `401` and
code `42501` for anon.

| # | Command | Expected |
|---|---|---|
| A1 | `sb "$URL/rest/v1/profiles?select=*"` | `[]` |
| A2 | `sb "$URL/rest/v1/donations?select=*"` | `[]` |
| A3 | `sb "$URL/rest/v1/donor_secrets?select=*"` | `42501` permission denied |
| A4 | `sb "$URL/rest/v1/request_contacts?select=*"` | `42501` permission denied |
| A5 | `sb "$URL/rest/v1/notifications?select=*"` | `42501` permission denied |
| A6 | `sb "$URL/rest/v1/blood_requests?select=id,status,city"` | only `active` rows (4), no fulfilled one |
| A7 | `sb "$URL/rest/v1/blood_requests?select=contact_phone"` | `42703` column does not exist |
| A8 | `sb "$URL/rest/v1/public_donors?select=id,display_name,blood_group,is_public_profile"` | private donors have `null` name and group |
| A9 | `sb "$URL/rest/v1/public_donors?select=present_zip"` | `42501` permission denied |
| A10 | `sb -X PATCH "$URL/rest/v1/public_donors?id=eq.00000000-5eed-4000-8000-000000000022" -H 'Content-Type: application/json' -d '{"is_public_profile":true}'` | `42501`; donor stays private |
| A11 | `sb -X POST "$URL/rest/v1/blood_requests" -H 'Content-Type: application/json' -d '{"user_id":"00000000-5eed-4000-8000-000000000011","blood_group":"A+","units_needed":1,"hospital_name":"x","hospital_address":"x","urgency_level":"Low","contact_name":"x","location":{}}'` | `42501` |
| A12 | `sb -X POST "$URL/rest/v1/rpc/create_notification" -H 'Content-Type: application/json' -d '{"p_user_id":"00000000-5eed-4000-8000-000000000022","p_title":"x","p_message":"y"}'` | `42501` |
| A13 | `sb -X POST "$URL/rest/v1/rpc/rate_limit_hit" -H 'Content-Type: application/json' -d '{"p_key":"x","p_window_seconds":60,"p_max":1}'` | `42501` |
| A14 | `sb -X POST "$URL/rest/v1/rpc/get_request_contact" -H 'Content-Type: application/json' -d '{"p_request_id":"00000000-5eed-4000-8000-0000000000a1"}'` | `42501` |
| A15 | `sb -X POST "$URL/rest/v1/rpc/verify_donation" -H 'Content-Type: application/json' -d '{"p_donation_id":"00000000-5eed-4000-8000-0000000000d1","p_pin":"3333","p_units":1}'` | `42501` |
| A16 | `sb -X POST "$URL/rest/v1/rpc/public_stats"` | JSON counts (works) |
| A17 | `sb -X POST "$URL/storage/v1/object/list/proofs" -H "Authorization: Bearer $ANON" -H 'Content-Type: application/json' -d '{"prefix":""}'` | `[]` |

Signed in as an unrelated user:

```bash
TOKEN=$(curl -s "$URL/auth/v1/token?grant_type=password" -H "apikey: $ANON" -H 'Content-Type: application/json' \
  -d '{"email":"staging-donor-bpos@example.com","password":"VitalStaging-2026!"}' | jq -r .access_token)
alias sbu='curl -s -H "apikey: $ANON" -H "Authorization: Bearer $TOKEN"'
```

| # | Command | Expected |
|---|---|---|
| A18 | `sbu "$URL/rest/v1/profiles?select=id,email"` | exactly 1 row (own) |
| A19 | `sbu -X PATCH "$URL/rest/v1/profiles?id=eq.00000000-5eed-4000-8000-000000000025" -H 'Content-Type: application/json' -H 'Prefer: return=representation' -d '{"role":"admin","verification_status":"verified"}'` | row returned with `role` still `user` |
| A20 | `sbu "$URL/rest/v1/donor_secrets?select=*"` | only own PIN (`5555`) |
| A21 | `sbu "$URL/rest/v1/donations?select=*"` | `[]` (no offers of their own) |
| A22 | `sbu -X POST "$URL/rest/v1/rpc/get_request_contact" -H 'Content-Type: application/json' -d '{"p_request_id":"00000000-5eed-4000-8000-0000000000a1"}'` | `[]` (has not offered) |
| A23 | `sbu -X POST "$URL/rest/v1/rpc/verify_donation" -H 'Content-Type: application/json' -d '{"p_donation_id":"00000000-5eed-4000-8000-0000000000d1","p_pin":"3333","p_units":1}'` | error "Only the person who posted this request can confirm donations" |
| A24 | `sbu -X PATCH "$URL/rest/v1/donations?id=eq.00000000-5eed-4000-8000-0000000000d1" -H 'Content-Type: application/json' -d '{"status":"completed"}'` | no row changed |
| A25 | `sbu -X POST "$URL/storage/v1/object/proofs/00000000-5eed-4000-8000-000000000021/x.txt" -H 'Content-Type: text/plain' --data 'x'` | rejected: row-level security error (`403` in the body; other user's folder) |

Pass = every row matches. Record actual responses next to each number.

### B. Guest email-code request flow (closes "Email-code request flow untested")

Use a private/incognito window on the staging preview, signed out.

1. Open `/requests/new`. Fill: blood group **A+**, 1 unit, any hospital, mark
   the map, **City `Testville`**, a contact name and phone `0000099999`.
2. Enter a **new** email address (any address works with a sandbox inbox,
   e.g. `qa-guest-1@example.com`) and press **Send code**.
   - Expect: "Code sent" toast; an email in the sandbox inbox **containing a
     6-digit code** (this is the *Confirm signup* template, see step 4).
3. Enter a wrong code: expect "That code is incorrect or has expired".
4. Enter the right code, then submit the form.
   - Expect: success toast "Compatible donors in Testville are being notified".
   - Network tab, `POST /api/notify/donors`: `matchedDonors: 4`
     (O+ Arun, O- Bina, A- Dinesh, A+ Chitra).
   - Sandbox inbox: alert emails to exactly those four addresses. **None** to
     `staging-donor-away` (unavailable) or `staging-donor-other` (Otherville).
5. Signed out in another window, open the new request: it is listed, the
   contact phone is **not** shown.
6. Repeat with an email that already has an account
   (`staging-req2@example.com`): the code arrives with the *Magic Link*
   template and the request posts under that account.
7. Abuse brakes: posting more than 5 requests within an hour from one account
   returns `429` from `/api/notify/donors`; calling it again for a request
   older than 10 minutes returns `409`.
8. The guest account is not listed as a donor (`/nearby-donors`, donor
   counts unchanged).

### C. Donor offer, PIN, verify

1. Sign in as `staging-donor-opos@example.com` (O+, PIN 1111). Open
   req2's **B+ Testville Clinic** request and offer to donate.
   - Expect: the contact phone `0000020003` becomes visible after offering.
2. Withdraw and re-offer: phone hidden while withdrawn, visible again after.
3. Sign out; sign in as `staging-req2@example.com`. Open the request's offers.
   - Donor shown as a masked name ("Arun T."), phone visible while open.
4. Confirm with PIN `0000`: rejected ("PIN does not match"), offer stays pending.
5. Confirm with PIN `1111` and **1** unit: offer completed, request still
   open (1 of 3).
6. Try to confirm more units than still needed: rejected ("Only N more unit(s) needed").
7. Pre-built case: sign in as `staging-req1@example.com`, confirm Chitra's
   pending offer on the A+ request with PIN `3333`, 1 unit. The request is
   now **fulfilled** and disappears from the signed-out request list.
8. Sign in as Chitra (`staging-donor-apos`): the fulfilled request is still
   in her donations; she cannot mark any donation completed herself.

### D. Account deletion

1. Use the guest account from B (or register a new one with a sandbox
   address). Make sure it has a posted request.
2. Profile > **Delete account**, confirm.
   - Expect: signed out; signing in again with the code says no account /
     creates a fresh one; the request is gone from the public list.
3. Confirm in the staging SQL editor (replace the email):

   ```sql
   SELECT
     (SELECT count(*) FROM auth.users WHERE email = 'qa-guest-1@example.com') AS auth_users,
     (SELECT count(*) FROM public.profiles WHERE email = 'qa-guest-1@example.com') AS profiles;
   -- both 0
   ```

### E. Reset

Re-run `supabase/seed.staging.sql` to restore all fixtures. Accounts created by
QA (non-fixture emails) are left alone; delete them from **Authentication >
Users** if needed. Free projects pause after a week idle; restore from the
dashboard.
