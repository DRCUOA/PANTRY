# Pantry

Single-user pantry web app: stock, barcode scan (Open Food Facts), meal planning, shopping list, and light nutrition goals. See [REQUIREMENT.TXT](REQUIREMENT.TXT) for the product spec.

## Prerequisites

- **Node.js** 20+ (LTS recommended)
- **PostgreSQL** 14+ (local install, Docker, or a hosted instance)

## 1. Install dependencies

```bash
npm install
```

## 2. Environment variables

Create a `.env` file in the project root (you can copy [`.env.example`](.env.example)):

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string, e.g. `postgresql://postgres:postgres@localhost:5432/pantry` |
| `SESSION_SECRET` | Yes (prod) | At least 32 characters. Used to encrypt the session cookie. |
| `PORT` | No | HTTP port for `npm run dev` and `npm start` (default **3000** if unset). |
| `NEXT_DEV_HOST` | No | Hostname/IP for `npm run dev` to bind to. Default **`0.0.0.0`** (all interfaces) so you can open the app from another device on your network. Set to `127.0.0.1` for localhost-only. |
| `NEXT_DEV_HTTPS` | No | Enable HTTPS in dev mode (**`true`** by default). Required for camera/barcode scanning on iPad or phone over LAN. Set to `false` to disable. |
| `NEXT_PUBLIC_APP_URL` | No | Public origin of the app (no trailing slash), e.g. `https://pantry.example.com`. Used when building password-reset links if the request host is not available. |

**Note:** `npm run dev` / `npm start` load `.env` then `.env.local` (`.env.local` wins on conflicts) via [`scripts/run-next.mjs`](scripts/run-next.mjs) so **`PORT` and other vars are available before Next.js starts**. Dev mode passes `-H 0.0.0.0` and `--experimental-https` to Next.js by default so the camera works on iPad/phone over LAN.

**Sessions:** The sign-in cookie no longer uses a short 14-day expiry; it is set to about **400 days** so you are not logged out on a fixed short timer. **Password reset:** Use **Forgot password?** on the login page. In development, the reset URL is shown on screen after you submit your email (no email is sent). In production, set `NEXT_PUBLIC_APP_URL` and plan to add email delivery if you need links sent automatically.

Example `.env`:

```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/pantry
SESSION_SECRET=your-secret-at-least-32-characters-long
PORT=3000
```

## 3. Database setup

### Option A — Docker (quick local Postgres)

```bash
docker run --name pantry-pg \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=pantry \
  -p 5432:5432 \
  -d postgres:16
```

Use `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/pantry` in `.env`.

### Option B — Local PostgreSQL

1. Create a database (example name `pantry`):

   ```bash
   createdb pantry
   ```

   Or using `psql`:

   ```sql
   CREATE DATABASE pantry;
   ```

2. Set `DATABASE_URL` in `.env` to match your user, password, host, and database name.

### Apply schema

From the project root (with `DATABASE_URL` set):

**Recommended — migrations:**

```bash
npm run db:migrate
```

**Alternative — push schema without migration files (handy for dev):**

```bash
npm run db:push
```

### Optional — seed a dev user

Creates `dev@example.com` / `devpassword123` unless overridden by `SEED_EMAIL` / `SEED_PASSWORD`:

```bash
npm run db:seed
```

You can also register a new account at `/register`.

## 4. Run the app (development)

```bash
npm run dev
```

Open `http://localhost:<PORT>` using the `PORT` in your `.env` (e.g. `http://localhost:3000` when `PORT=3000` or when `PORT` is omitted and Next falls back to 3000).

## 5. Production build

```bash
npm run build
npm start
```

Again, `PORT` and `DATABASE_URL` are read from `.env` / `.env.local` when using `npm start`.


## Plan gesture smoothness micro-benchmark (dev note)

When touching drag/swipe behavior in the plan UI, run a quick manual benchmark on physical devices/browsers:

1. Open `/plan` in dev mode.
2. Swipe between weeks repeatedly (10-15 times each direction).
3. Drag meals across day columns with touch/pointer and with keyboard reordering controls.

Expected smoothness criteria:

- No visible stutter or hitching while dragging overlay and while crossing day columns.
- Swipe-triggered navigation should feel immediate and consistent (no duplicate or dropped nav).
- Verified on modern iPhone Safari and an Apple Silicon M3-class Mac in Safari/Chrome.

## Other scripts

| Command | Description |
|---------|-------------|
| `npm run lint` | ESLint |
| `npm test` | Vitest unit tests |
| `npm run db:generate` | Generate a new Drizzle migration from `src/db/schema.ts` |

## Project layout (high level)

- `src/app/` — App Router pages (home, pantry, scan, plan, settings, auth)
- `src/actions/` — Server actions
- `src/db/` — Drizzle schema and `getDb()`
- `drizzle/` — SQL migrations
