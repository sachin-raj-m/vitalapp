# WhatsApp alerts

Vital uses Meta's WhatsApp Cloud API directly (no reseller). Everything is
built and switched off until the variables below are set and
`WHATSAPP_ENABLED=true`. While it is off, donors get email alerts as before,
and any WhatsApp message the app would have sent is logged in
`whatsapp_messages` with status `disabled`.

## How it works

| When | Who | Message | Sent by |
|---|---|---|---|
| A request is posted | Opted-in donors nearby (max 3 alerts a day each) | `vital_donor_alert`: **I can donate** / **Not this time** / **View request** | `app/api/notify/donors` |
| Donor taps **I can donate** | Donor | Self-check with **Yes, all true** / **Not today** | webhook (free reply) |
| Donor taps **Yes, all true** | Donor | Offer recorded, link to the contact person and their PIN (30 min) | webhook |
| Same moment | Requester, if they ticked WhatsApp updates | `vital_offer_received`: link to the donor's contact | webhook |
| Daily, 11:00 IST, for offers older than 12 h | Requester | `vital_donation_followup`: **Yes** / **Not yet** / **No** (up to 3 times) | `app/api/cron/whatsapp-followups` |
| Requester taps **Yes** and types the PIN | Requester | Confirmed, or tries left | webhook (`verify_donation_for`) |
| Donation confirmed (web or WhatsApp) | Donor | `vital_donor_thanks` from Sachin, with their invite link (also by email) | `lib/donation-events.ts` |
| Request fully covered | Other alerted donors | `vital_request_covered` | `lib/donation-events.ts` |

People can reply **STOP**, **START** or **LINK** (a fresh contact link) at any
time. Phone numbers are never put in a WhatsApp message: contacts are only
shown on `vitalapp.in/c/<token>`, after pressing "Show contact details", and
stay visible for 15 minutes.

Opt-in: ticked by default on the registration form (donors) and the request
form (requesters, per request). Donors turn it off in **Settings > Alerts** or
by replying STOP. Existing donors can turn it on in Settings.

## Setup (you)

1. **Meta Business account** at business.facebook.com.
2. **developers.facebook.com** > Create app > type *Business* > add **WhatsApp**.
   You get a free test number; add your own phone as a test recipient.
3. Add Vital's **own number** (not used in the WhatsApp app) and a display name.
4. Start **Business verification** (Business settings > Security centre).
   Unverified accounts can message about 250 people a day.
5. Create a **System user** with a **permanent token** that has
   `whatsapp_business_messaging` and `whatsapp_business_management`.
6. **Webhook**: in the WhatsApp > Configuration page set
   - Callback URL: `https://vitalapp.in/api/whatsapp/webhook`
   - Verify token: the value of `WHATSAPP_VERIFY_TOKEN`
   - Subscribe to the **messages** field.
7. Submit the templates below: the five alert templates as **Utility** and
   `vital_verify_code` as **Authentication** (language **English**).
8. Set the variables in Vercel (Production), then `WHATSAPP_ENABLED=true` and
   `NEXT_PUBLIC_WHATSAPP_ENABLED=true` once the templates are approved, and
   redeploy (the public one is read at build time).

| Variable | Where it comes from |
|---|---|
| `WHATSAPP_TOKEN` | System user permanent token |
| `WHATSAPP_PHONE_NUMBER_ID` | WhatsApp > API setup |
| `WHATSAPP_APP_SECRET` | App settings > Basic > App secret (signs webhooks) |
| `WHATSAPP_VERIFY_TOKEN` | Any long random string you choose |
| `CRON_SECRET` | Any long random string (Vercel sends it to the daily job) |
| `WHATSAPP_ENABLED` | `true` to send |
| `NEXT_PUBLIC_WHATSAPP_ENABLED` | `true` to show "Confirm on WhatsApp" for phone numbers |
| `WHATSAPP_TEMPLATE_LANG` | Optional, default `en` |

## Templates

Variables are `{{1}}`, `{{2}}`… in order. Button order matters: the code sends
payloads by position.

**vital_donor_alert**
> {{1}} blood is needed at {{2}}. {{3}}
>
> You're registered on Vital as a donor who can give to this patient. Can you help?

Footer: `Reply STOP to stop alerts`
Buttons: Quick reply **I can donate** · Quick reply **Not this time** ·
URL **View request** → `https://vitalapp.in/requests/{{1}}`
Example: `O+` · `General Hospital, Kochi` · `Needed by Thu, 12 Oct.`

**vital_offer_received**
> {{1}} has offered to donate for your {{2}} request at {{3}}.
>
> Open the link to see their number and call them to arrange it. After they donate, ask for their 4-digit PIN to confirm it.

Buttons: URL **See contact** → `https://vitalapp.in/c/{{1}}`

**vital_donation_followup**
> Did {{1}} donate for your {{2}} request at {{3}}?

Buttons: Quick reply **Yes** · Quick reply **Not yet** · Quick reply **No**

**vital_donor_thanks**
> Thank you, {{1}}. Your donation at {{2}} has been confirmed. You didn't have to show up, and you did.
>
> Know someone who could be a donor? Share your invite link: {{3}}
>
> With gratitude,
> Sachin, Vital

**vital_request_covered**
> Update: the {{1}} request at {{2}} now has the donors it needs. Thank you for being ready to help. We'll alert you again when you're needed.

**vital_verify_code** (Authentication)
Use Meta's authentication template builder: code delivery **Copy code**, with
the security recommendation and a 10-minute expiry note. The code fills `{{1}}`
and the copy-code button.

## Phone numbers

There is no SMS. A new number in **Settings** is confirmed with a 6-digit code
sent on WhatsApp (`app/api/profile/phone`); `profiles.phone_verified_at` records
it, and any user-made change to the number clears it. While WhatsApp is off,
numbers are saved without a code, as at registration.

## Testing without Meta

With `WHATSAPP_ENABLED` unset, flows still run and log to `whatsapp_messages`
(status `disabled`). The webhook can be exercised by POSTing a payload signed
with `WHATSAPP_APP_SECRET` (`X-Hub-Signature-256: sha256=<hmac>`).
