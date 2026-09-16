# Sidekick

A verified BU-only marketplace where students post anything they need done, set a
price and a deadline, and have nearby verified students claim and complete it.

Three pillars, in priority order:

1. **Trust** — BU email verification → reputation → protected payments
2. **Proximity** — location → distance → transportation → availability
3. **Liquidity** — post → match → message → complete → get paid

Everything else is secondary, and the code reflects that.

## Running it

```bash
npm install
npm run db:reset   # creates the SQLite file and seeds a believable campus
npm run dev        # http://localhost:3000
```

Sign in with any seeded address — `alexr@bu.edu`, `priyan@bu.edu`,
`marcust@bu.edu` — or any other `@bu.edu` address to create a new account. In
development the verification code is **printed to the server console**; there is
no mail provider to configure.

## Getting it onto a phone

Three levels, cheapest first.

**1. Your phone, same Wi-Fi — nothing to set up.** `npm run dev` prints a
`Network:` URL like `http://10.0.0.12:3000`. Open that on your phone. School and
office Wi-Fi often isolate devices from each other, so if it hangs, skip to 2.

**2. Any phone, anywhere — one command.**

```bash
npm run share
```

This prints a public HTTPS link to your laptop's dev server. Good for handing
someone your screen; the link dies when you stop the command, and everything is
served by your laptop. Install `cloudflared` once (`brew install cloudflared`)
for a reliable tunnel.

**3. A real URL that's always up.** See Deploying below.

### Install it to the home screen

On the phone, open the site → Share → **Add to Home Screen**. It gets the
Sidekick icon and opens without browser chrome, which is most of what makes a
web app feel native. No App Store review, no TestFlight.

## Deploying

The database is a file on disk, so Sidekick needs a host with a **persistent
volume** — not a serverless platform, where the filesystem is wiped on every
request. `Dockerfile` works anywhere; `fly.toml` is set up for Fly.io in Boston:

```bash
fly launch --no-deploy                 # keep the existing fly.toml when asked
fly volumes create sidekick_data --size 1 --region bos
fly secrets set SIDEKICK_SECRET=$(openssl rand -hex 32)
fly secrets set RESEND_API_KEY=re_... MAIL_FROM="Sidekick <verify@yourdomain.com>"
fly deploy
```

Railway and Render work the same way — point them at the Dockerfile, mount a
volume at `/data`, and set the same environment variables.

Keep it to **one machine**. SQLite allows a single writer, so two instances
would fight over the same file. That's the ceiling that eventually forces the
move to Postgres, and it's a long way above where BU will be for a while.

The server runs a configuration check at startup and **refuses to boot** if the
signing secret or mail provider is missing, failing the health check so a bad
deploy rolls back instead of serving a sign-in page that breaks the moment a
student uses it.

## Turning on real signups

Development prints codes to the console. To actually email them:

1. Create an API key at [resend.com/api-keys](https://resend.com/api-keys)
2. **Verify a domain** at [resend.com/domains](https://resend.com/domains)
3. Copy `.env.example` to `.env` and set `RESEND_API_KEY`, `MAIL_FROM` (an
   address at that verified domain) and `SIDEKICK_SECRET`
4. Confirm delivery before trusting it:

```bash
npm run mail:test -- someone@bu.edu
```

**Step 2 is not optional.** Until a domain is verified, Resend delivers only to
the address that owns the API key — so it will reach you and refuse every
student, which looks like the app working right up until it doesn't. The test
command names that exact failure when it happens.

Two things are hard failures in production rather than warnings, because both
would otherwise look identical to a working system from the inside:

- **No `SIDEKICK_SECRET`.** It signs the pending-signup cookie. On the
  checked-in default, anyone could forge that cookie and register any `@bu.edu`
  address without ever receiving a code.
- **No mail provider.** A dropped code is a student who can't sign up.

## What's built

The full core loop is real and enforced server-side:

- **Verification** — `@bu.edu` only, hashed 6-digit codes, 10-minute expiry,
  attempt limits, per-address throttling, signed session cookies
- **Posting** — one-line description drives automatic categorization, location,
  transportation, duration and a campus price suggestion, all editable
- **Feed** — Nearby / For You / New / Ending Soon, filtered by distance,
  transportation, category, minimum pay, time window and remote
- **Available Now** — pick a window, get the highest-earning run that actually
  fits it, including round-trip travel at your fastest mode
- **Offers** — apply with a note and optional counter-price; accepting assigns
  the task and declines the rest atomically
- **Messaging** — one thread per offer, so there are no cold DMs
- **Completion and reviews** — poster confirms, two-way reviews, star ratings
  and a separate Campus Trust Score
- **Safety** — content screening at post time, safe handoff spots on every
  physical task, report and block

Payments are **simulated**. Escrow, payouts, fees and disputes are modeled
end-to-end in the UI and data, behind an interface Stripe Connect drops into.

## The fee

Marginal, like a tax bracket: **5% on the first $20 of a task, 10% above it.**

| Task | Fee | Effective rate | Tasker receives |
|------|-----|----------------|-----------------|
| $12  | $0.60 | 5.0% | $11.40 |
| $20  | $1.00 | 5.0% | $19.00 |
| $40  | $3.00 | 7.5% | $37.00 |
| $100 | $9.00 | 9.0% | $91.00 |

Cheap errands are the flywheel — the $12 laundry runs are what build liquidity,
and a full-rate fee bites hardest exactly there.

The rate is marginal rather than a flat "5% under $20, 10% at or above" because
a threshold creates a cliff: a $20 task would pay the tasker $18.00 while a
$19.99 task paid $18.99, so the rounder, more generous price quietly pays the
worker less — and $20 is the most common price point on the platform. Both
constants live in `lib/pricing.ts`.

## What's deliberately not built

Map view, push notifications, business and student-org accounts, recurring
tasks, saved searches, and multi-campus support. These are V2 — they matter only
after BU has genuine liquidity, and building them now would be building for a
network that doesn't exist yet.

## Recovering a locked-out account

If an account was created before the pending-cookie fix, its address was stored
truncated at the first dot (`mikec@bu`, or bare `first` for `first.last@bu.edu`),
so signing in with the real address found nothing and the sign-up form answered
"that account already exists". Repair it:

```bash
npm run db:repair
```

That rebuilds any address it can and names the ones it can't, which you set by
hand: `npm run db:repair -- <handle> <correct@bu.edu>`.

## Tests

```bash
npm test
```

Covers the pending-token round trip (dotted addresses included), the BU email
gate, and the trust score. The token tests exist because that codec is what
locked a real account out.

## Architecture

```
app/
  (app)/        authenticated shell — feed, now, post, tasks, messages, profile
  api/          route handlers; every mutation re-checks authorization
  welcome/      email → code → profile onboarding
components/     UI; client components only where interaction demands it
lib/
  db.ts         SQLite schema + typed query helpers
  queries.ts    data access, feed ranking, Available Now scheduling
  auth.ts       verification, sessions, trust score
  taxonomy.ts   categories, transportation, skills
  geo.ts        real BU coordinates, distance, safe meeting spots
  infer.ts      post-time categorization heuristics
  pricing.ts    campus price suggestions and fee math
  safety.ts     prohibited-content policy
  credentials.ts  pure credential logic — no cookies, no db, so it's testable
```

**Storage** is SQLite through Node's built-in `node:sqlite` driver — no native
build step, no ORM. Every query is plain SQL against a normalized schema, so
moving to Postgres is a driver swap and a handful of dialect edits.

**Inference** (`lib/infer.ts`) is a transparent keyword model, not a language
model. It runs instantly and offline, and every guess is shown as an editable
suggestion rather than applied silently. A real model can replace it behind the
same interface.

**Pricing** (`lib/pricing.ts`) is a documented heuristic over category, duration,
distance, vehicle requirement and urgency. Once there's completion data, the same
function can be backed by observed clearing prices.

## Notes on a few decisions

**Transportation is a filter, not a label.** `transportSatisfies` encodes that a
car covers what a bike could do but a bike doesn't cover a furniture pickup, so a
walking-only student never sees a couch in Medford.

**Trust score is separate from stars** on purpose. Stars say how good someone is;
trust says how safe they are to transact with. Conflating them lets a
high-skill, high-cancellation account look safe.

**Messaging requires an offer.** There is no path to message a stranger, which is
what keeps this from becoming an anonymous DM platform.

**Academic tasks have a real policy.** Tutoring and study help are welcome;
completing graded work for someone else is screened at post time and refused with
an explanation. This is the moderation category most likely to cause trouble at
BU, so it's handled before launch rather than after.

**BU only.** The email domain is a single environment variable, but the product
bet is density over breadth — BC, Harvard, MIT and Northeastern come after BU has
genuine liquidity, not on day one.
