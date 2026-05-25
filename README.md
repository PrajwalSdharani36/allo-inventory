# Allo Inventory — Take-Home Exercise

A Next.js inventory reservation system for multi-warehouse retail. Handles the checkout race condition by temporarily holding stock with a 10-minute reservation window.

Live URL: _[deploy and fill in]_

---

## How to run locally

### 1. Clone & install

```bash
git clone <your-repo-url>
cd allo-inventory
npm install
```

### 2. Set up services

You need two hosted services (both have free tiers):

| Service | Purpose | Recommended |
|---------|---------|-------------|
| PostgreSQL | Primary data store | [Neon](https://neon.tech) |
| Redis | Distributed locking + idempotency | [Upstash](https://upstash.com) |

### 3. Configure environment variables

```bash
cp .env.example .env.local
# Fill in your DATABASE_URL, DIRECT_URL, UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN
```

For Neon: use the **pooled** connection string for `DATABASE_URL` and the **direct** string for `DIRECT_URL`.

### 4. Run migrations & seed

```bash
npx prisma migrate dev --name init
npm run db:seed
```

### 5. Start the dev server

```bash
npm run dev
```

Visit `http://localhost:3000`.

---

## Architecture decisions

### How concurrency safety works

The core challenge: two simultaneous POST `/api/reservations` requests for the last unit of a SKU must not both succeed.

**Two-layer defence:**

1. **Redis distributed lock** (`SET NX PX`): Before touching the database, we acquire an atomic lock keyed to `reserve:{productId}:{warehouseId}`. Only one request holds the lock at a time. Concurrent requests get a 429 and can retry. The lock auto-expires after 8 seconds (well above any transaction time) so a crash can't deadlock.

2. **PostgreSQL `SELECT FOR UPDATE`**: Inside a database transaction, we lock the `Stock` row at the DB level. This is the safety net if the Redis lock is unavailable or if multiple app instances are running without a shared Redis (e.g. cold-start race).

Together: Redis prevents thundering-herd pressure on the DB, and `FOR UPDATE` is the authoritative correctness guarantee.

### How expiry works in production

Reservations have an `expiresAt` timestamp (now + 10 minutes).

**Lazy cleanup (primary):** Every query that computes available stock filters `status = PENDING AND expiresAt > NOW()`. Expired reservations are invisible to new reservation requests without needing a background job. This is the correctness guarantee.

**Vercel Cron (secondary):** `vercel.json` schedules `GET /api/cron/expire` every minute. This job does `UPDATE reservations SET status = 'RELEASED' WHERE status = 'PENDING' AND expiresAt < NOW()`. It keeps the database tidy and ensures stock counters stay accurate even if lazy cleanup isn't hit. The cron is protected by a `CRON_SECRET` env var.

The combination means correctness doesn't depend on the cron running — it's purely for hygiene.

### Idempotency (bonus)

Both `POST /api/reservations` and `POST /api/reservations/:id/confirm` support an `Idempotency-Key` header.

Implementation:
- On first request: process normally, store `{ key → response }` in Redis with TTL slightly longer than the reservation window.
- On retry with same key: return the cached response immediately with `X-Idempotent-Replayed: true` header, skipping all side effects.
- The key is scoped by endpoint prefix (`idempotency:` vs `idempotency:confirm:`) so the same key used for reserve and confirm doesn't collide.

This handles 3DS redirect loops, flaky mobile networks, and double-click form submissions.

---

## API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/products` | Products with live available stock per warehouse |
| GET | `/api/warehouses` | All warehouses |
| GET | `/api/reservations/:id` | Single reservation details |
| POST | `/api/reservations` | Create reservation (409 if insufficient stock) |
| POST | `/api/reservations/:id/confirm` | Confirm (410 if expired) |
| POST | `/api/reservations/:id/release` | Release / cancel |
| GET | `/api/cron/expire` | Release all expired pending reservations |

---

## Trade-offs & things I'd do differently

**With more time:**
- Add a `GET /api/reservations` endpoint with pagination for an admin view
- Add user sessions so reservations are tied to a user (currently sessionless)
- Implement optimistic UI updates with `useOptimistic` (React 19)
- Add E2E tests (Playwright) covering the concurrent reservation scenario
- Add a retry loop on the frontend when a 429 is returned (lock contention)
- Consider row-level locking via advisory locks (`pg_try_advisory_xact_lock`) instead of Redis — one fewer infrastructure dependency

**Known limitations:**
- No authentication — anyone with a reservation ID can confirm/release it
- The `SELECT FOR UPDATE` uses raw SQL because Prisma doesn't natively expose `FOR UPDATE` yet
- Cron granularity is 1 minute on Vercel free tier; expired reservations can linger up to 1 minute (lazy cleanup on read covers this)

**What I'm most confident about:**
The concurrency guarantee. The combination of Redis atomic lock + Postgres `FOR UPDATE` means exactly-once semantics for the last unit, regardless of race conditions.
