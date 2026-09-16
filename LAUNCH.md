# Launching Sidekick

Everything needed to go from this repository to an app on the App Store taking
real money. Ordered so each step unblocks the next, with the accounts you need
and roughly what they cost.

Work through it in order. Steps 1–4 can be done in an afternoon. Step 5 is the
one with a waiting period, so start it early.

---

## 0. What you can do today, with nothing

```bash
npm install && npm run db:reset && npm run preview
```

Verification codes print to the terminal. No accounts, no keys, no cost. Use
this to show people the product before spending anything.

---

## 1. A domain — ~$12/year

Buy one (Namecheap, Cloudflare Registrar). You need it before email, because
Resend verifies a domain you own, and `bu.edu` is not yours.

Something like `sidekickbu.com`. Avoid putting "BU" in a way that implies the
university endorses you — see §9.

---

## 2. Email, so students can actually sign up — free

Nobody can create an account until this works.

1. Sign up at [resend.com](https://resend.com) (free tier: 3,000/month)
2. **Domains → Add Domain**, enter your domain
3. Add the DKIM/SPF DNS records it gives you at your registrar
4. Wait for verification (minutes to a few hours)
5. **API Keys → Create**

```bash
RESEND_API_KEY=re_...
MAIL_FROM="Sidekick <verify@yourdomain.com>"
```

Confirm it before trusting it:

```bash
npm run mail:test -- someone@bu.edu
```

**The trap:** until the domain is verified, Resend delivers only to the address
that owns the API key. It will work when you test it on yourself and fail for
every student. The test command detects exactly this and says so.

---

## 3. Hosting — ~$5/month

The database is a file on disk, so it needs a persistent volume. That rules out
Vercel.

```bash
fly launch --no-deploy                 # keep the existing fly.toml
fly volumes create sidekick_data --size 1 --region bos
fly secrets set SIDEKICK_SECRET=$(openssl rand -hex 32)
fly secrets set RESEND_API_KEY=re_... MAIL_FROM="Sidekick <verify@yourdomain.com>"
fly secrets set ADMIN_EMAILS=you@bu.edu
fly deploy
```

Stay on **one machine**. SQLite allows a single writer; two instances would
corrupt each other. That is the ceiling that eventually forces Postgres, and
it is a long way past where BU will be for months.

The server refuses to boot without a signing secret or mail provider, and fails
its health check if either is missing — so a broken deploy rolls back instead of
serving a sign-in page that breaks on first use.

---

## 4. The map — free, optional

Skip this and the drawn campus map is used, which costs nothing and works
offline. For real tiles:

1. [mapbox.com](https://mapbox.com) → free tier is 50,000 map loads/month
2. **Tokens → Create a token**, default public scopes
3. **Restrict it to your domain** under URL restrictions

```bash
NEXT_PUBLIC_MAPBOX_TOKEN=pk....
```

This token is public by design — it ships to the browser. The URL restriction,
not secrecy, is what protects it.

---

## 5. Payments — start this first, it has the longest wait

### What you must accept before starting

**You cannot hold student money yourself.** Holding funds on behalf of other
people is money transmission and requires licensing in most states. Stripe is
the licensed party; Sidekick is a platform on top of it. This is not a technical
choice and there is no way around it that is both legal and cheap.

**"In-app payments" means the card sheet is in the app, not a browser redirect
— and that is exactly what this does.** Card details go straight to Stripe from
an iframe Stripe controls. They never touch your server, which is the difference
between a short PCI self-assessment and an annual audit.

### Setup

1. Create a Stripe account at [stripe.com](https://stripe.com)
2. Enable **Connect** (Dashboard → Connect → Get started), platform type
   **Express**
3. Fill in your platform profile — Stripe asks what the marketplace does
4. Copy your **test** keys from Developers → API keys

```bash
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

5. Add a webhook endpoint at `https://yourdomain.com/api/webhooks/stripe`,
   subscribed to:
   - `payment_intent.succeeded`
   - `account.updated`
   - `charge.dispute.created`

```bash
STRIPE_WEBHOOK_SECRET=whsec_...
CRON_SECRET=$(openssl rand -hex 32)
```

6. Schedule the auto-release job — hourly is fine:

```bash
curl -X POST https://yourdomain.com/api/cron/auto-release \
  -H "Authorization: Bearer $CRON_SECRET"
```

Test locally with `stripe listen --forward-to localhost:3000/api/webhooks/stripe`
and card `4242 4242 4242 4242`.

### How the money actually moves

```
poster accepts an offer
   ↓
poster is charged; funds sit with the platform, not the tasker
   ↓
tasker does the work, knowing it is already funded
   ↓
poster confirms  →  payout transfers to the tasker
   or 72h passes →  it releases automatically
   or either side disputes → frozen for review in /admin
```

Each piece exists for a reason:

- **Charging at accept** stops a poster from ghosting after the work is done.
- **Holding until confirmation** stops a tasker from taking money and vanishing.
- **Auto-release after 72 hours** stops a poster from sitting on someone's money
  by simply not responding — the most common way marketplaces quietly cheat the
  people doing the work.
- **Either side can freeze it**, so a real problem stops the clock.
- **Every transfer and refund is idempotent**, so a double-tap or a redelivered
  webhook cannot pay twice.

### The friction you should expect

Taskers must complete Stripe Express onboarding before they can be paid: legal
name, date of birth, last four of SSN, and a bank account. For an 18-year-old
this is a real drop-off point. Two things help: only ask at the moment they are
about to be paid (which is where it sits now), and say plainly that Stripe
collects it and you never see it.

### Going live

Switch to live keys only once you have:
- a real business entity (an LLC is typical; a sole proprietorship can work)
- an EIN
- a bank account in the business's name
- read Stripe's Connect platform agreement — as the platform, **you** are
  responsible for what happens on it

---

## 6. Notifications — free

**Web Push** (browsers, Home Screen installs):

```bash
npm run push:keys      # prints a VAPID keypair
```

**APNs** (the App Store build), from
[developer.apple.com](https://developer.apple.com) → Certificates, Identifiers
& Profiles → **Keys**:

1. Create a key with **APNs** enabled
2. Download the `.p8` — **Apple only lets you download it once**
3. Note the Key ID and your Team ID

```bash
APNS_KEY_ID=ABC1234567
APNS_TEAM_ID=DEF7654321
APNS_BUNDLE_ID=edu.bu.sidekick
APNS_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIGT...\n-----END PRIVATE KEY-----"
APNS_ENVIRONMENT=sandbox     # production once shipped
```

Newlines in the key are written as `\n`.

---

## 7. The iOS app — $99/year, needs a Mac

The web app is the product; the iOS app is a native shell around it. Because it
loads your deployed URL rather than a bundled copy, **shipping a fix does not
need App Store review** — only changes to native capability do.

1. Join the [Apple Developer Program](https://developer.apple.com/programs/) —
   $99/year, approval takes 24–48 hours
2. On your Mac:

```bash
npm i @capacitor/core @capacitor/ios @capacitor/push-notifications @capacitor/app
npx cap add ios
npx cap open ios
```

3. In Xcode:
   - Set the bundle identifier to match `APNS_BUNDLE_ID`
   - Signing & Capabilities → **+ Capability** → Push Notifications
   - **+ Capability** → Background Modes → check **Remote notifications**
4. In App Store Connect: create the app record, upload a build, submit

### What review will ask about

- **A demo account.** They will not sign up with a `bu.edu` address. Create one
  and put the credentials in App Review notes, or they will reject for being
  unable to see the app.
- **Why it is restricted to BU.** Explain the verification model plainly.
- **Payments.** Real-world services are exempt from in-app purchase — the same
  exemption TaskRabbit and Uber rely on. Say so in the review notes.
- **Account deletion.** Required since 2022. It is built, at Settings → Delete
  my account. Point them to it.
- **A privacy policy URL.** Required. See §9.

---

## 8. Moderation — this is what `/admin` is for

You asked what use an admin console is on a published app. It is the answer to
"a student says someone didn't show up and took their money."

At `/admin`, gated by `ADMIN_EMAILS`, you can:

- **Settle frozen payments** — release to the tasker or refund the poster. Once
  money is real, this is the queue that matters most.
- **Act on reports** — suspend an account, which ends its session immediately and
  takes its open tasks down.
- **See whether the thing is working** — signups, GMV, fees, held escrow.

Without it, a report is a row in a table nobody reads, and a frozen payment
stays frozen forever.

**Use it from a browser, not the iOS app.** It is reachable from the phone since
the shell loads the same URL, but there is no reason to walk an App Store
reviewer past a moderation console. A non-admin gets a 404 rather than a 403, so
its existence is not confirmed to anyone else.

---

## 9. The legal minimum before real users

Not optional once students are meeting strangers and money is moving.

- **Business entity** — an LLC separates your personal assets from the platform's
  liability. Worth doing before the first dollar, not after.
- **Terms of Service and Privacy Policy** — required by both Apple and Stripe.
  Templates exist; have someone read them.
- **Insurance** — general liability. Someone will hurt their back moving a couch.
- **The BU name.** Using "BU" in the app name or logo may need permission from
  the university's trademark office. Ask before you print stickers. Describing
  it as "for BU students" is far safer than branding it as a BU product.
- **1099s** — you may need to issue them to taskers over the IRS threshold.
  Stripe Connect can handle this, but you must turn it on.

---

## The cheapest honest path

| | Cost | Blocks what |
|---|---|---|
| Domain | ~$12/yr | Email |
| Resend | free | Any signup at all |
| Fly.io | ~$5/mo | Anyone using it who isn't next to your laptop |
| Mapbox | free | Nothing — there's a fallback |
| Stripe | 2.9% + 30¢ | Real payments |
| Apple Developer | $99/yr | The App Store |
| LLC | ~$100–500 | Nothing technically; everything legally |

**Under $150 gets you a real app students can use.** The $99 Apple fee only buys
the App Store, and the web app already installs to the Home Screen for free.

## What I would do in what order

1. **Domain + Resend + Fly** — get it live, hand it to ten students. Free tier,
   one afternoon.
2. **Watch what breaks.** Ten real users will teach you more than any feature.
3. **Only then, Stripe.** Payments are the most work and the most risk, and they
   are pointless without liquidity. Until then the app is honest about charging
   nothing.
4. **App Store last.** The PWA install is free, instant, and enough to learn
   from. The $99 and the review queue buy distribution you do not need yet.
