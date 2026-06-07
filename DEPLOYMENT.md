# Group Fund — Deployment Guide

This is a monorepo with two independently-deployed services:

```
.
├── backend/    Django + DRF API + Django admin (Jazzmin) — Python 3.12, PostgreSQL
├── frontend/   Next.js 14 (App Router) — Node.js
├── Procfile    Railway/Heroku-style process file (backend release + web)
├── runtime.txt Python version pin for the backend
└── requirements.txt
```

The backend and frontend are **separate deployments** that talk to each other only over HTTP (REST API + JWT). They do not need to live on the same host or platform.

---

## 1. Architecture & what each service needs

| Service  | Runtime     | Needs                                            | Typical host                  |
|----------|-------------|--------------------------------------------------|-------------------------------|
| backend  | Python 3.12 | PostgreSQL database, (optional) S3-compatible bucket for media | Railway |
| frontend | Node.js 18+ | Only needs to know the backend's public URL      | Railway, Vercel, or any Node host |

> The repo's `Procfile` / `runtime.txt` are written for **Railway** deploying the `backend/` Django app (the `meta.deploy: railway` in `all.yaml`). The frontend has no Procfile — see [§4](#4-deploying-the-frontend) for how to deploy it.

---

## 2. Required accounts / provisioning before you start

1. **PostgreSQL database** — Railway's "PostgreSQL" plugin works out of the box (gives you `DATABASE_URL` style vars; map them to `DB_*` below, or add a `DATABASE_URL` parser if you prefer — the current `settings.py` reads discrete `DB_*` vars).
2. **(Strongly recommended) S3-compatible object storage bucket** for uploaded media (post images, contribution/expense receipts) — e.g. AWS S3, Cloudflare R2, or Backblaze B2. Railway's filesystem is **ephemeral**: anything written to local disk is wiped on every redeploy/restart. See [§5.4](#54-media-storage-s3) for why this matters and how to configure it.
3. A way to generate a strong `SECRET_KEY` (see [§3](#3-environment-variables)).

---

## 3. Environment variables

### 3.1 Backend (`backend/.env` locally, or Railway service variables)

Copy `.env.example` as a starting point. **Every variable below is read via `os.environ.get(...)` in `backend/groupfund/settings.py`** — nothing is hardcoded.

| Variable | Required in prod? | Example | Notes |
|---|---|---|---|
| `SECRET_KEY` | **Yes** | output of `python -c "import secrets; print(secrets.token_urlsafe(64))"` | Falls back to an insecure dev key (`insecure-dev-key-replace-in-production`) if unset — **never deploy with the default**. |
| `DEBUG` | **Yes** | `False` | Defaults to `True`. Must be `False` in production — enables HSTS/secure cookies/SSL redirect (see `settings.py:237`). |
| `ALLOWED_HOSTS` | **Yes** | `myapp.up.railway.app,mydomain.com` | Comma-separated, no scheme, no trailing slash. |
| `CSRF_TRUSTED_ORIGINS` | Usually no (auto-derived) | `https://myapp.up.railway.app` | Auto-derived as `https://` + each non-local `ALLOWED_HOSTS` entry. Only set explicitly if you need a different scheme/port/subdomain combination than that derivation produces. |
| `DB_ENGINE` | No | `django.db.backends.postgresql` | Defaults to Postgres. Override to `django.db.backends.sqlite3` only for local testing. |
| `DB_NAME` / `DB_USER` / `DB_PASSWORD` / `DB_HOST` / `DB_PORT` | **Yes** | from your Postgres plugin | |
| `CORS_ALLOWED_ORIGINS` | **Yes** | `https://myapp-frontend.up.railway.app` | Comma-separated **full origins with scheme**, no trailing slash. Must include the deployed frontend's origin or browser requests will be blocked by CORS. |
| `SECURE_SSL_REDIRECT` | No | `True` | Defaults to `True` when `DEBUG=False`. Set to `False` only if your platform already forces HTTPS upstream and redirect loops occur. |
| `AWS_STORAGE_BUCKET_NAME` | Recommended | `my-fund-media` | Setting this switches media storage from local disk to S3-compatible storage. Leave **unset** to use local disk (functional but ephemeral — see §5.4). |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | If bucket set | | Bucket credentials. |
| `AWS_S3_REGION_NAME` | If bucket set | `auto` / `eu-west-2` | |
| `AWS_S3_ENDPOINT_URL` | Non-AWS providers only | `https://<account-id>.r2.cloudflarestorage.com` | Required for Cloudflare R2 / Backblaze B2 / MinIO etc. Leave empty for AWS S3. |
| `AWS_S3_CUSTOM_DOMAIN` | Optional | `media.yourdomain.com` | If you front the bucket with a CDN/custom domain. |

### 3.2 Frontend (`frontend/.env` locally, or Railway/Vercel service variables)

| Variable | Required in prod? | Example | Notes |
|---|---|---|---|
| `NEXT_PUBLIC_API_URL` | **Yes** | `https://myapp-backend.up.railway.app` | No trailing slash. Baked into the client bundle at build time — **the frontend must be rebuilt whenever this changes**. |
| `NEXT_PUBLIC_SITE_NAME` | No | `Group Fund` | Cosmetic — shown in titles/branding. |
| `NEXT_PUBLIC_MEDIA_URL` | Only if `AWS_STORAGE_BUCKET_NAME` is set on the backend | `https://my-fund-media.s3.amazonaws.com` or `https://media.yourdomain.com` | Tells `next/image` which extra origin is allowed to serve images (the S3 bucket/CDN). Without it, S3-hosted images will fail to render with "hostname is not configured under images". |

---

## 4. Step-by-step: deploying the backend (Railway)

1. **Create a new Railway project**, add a **PostgreSQL** plugin, and a service pointing at this repo (root directory = repo root, since the `Procfile` does `cd backend && ...`).
2. **Set environment variables** per §3.1. At minimum: `SECRET_KEY`, `DEBUG=False`, `ALLOWED_HOSTS`, `DB_*` (or wire up Railway's Postgres reference variables to these names), `CORS_ALLOWED_ORIGINS`.
3. Railway auto-detects `runtime.txt` (Python 3.12) and `requirements.txt`, then runs the `Procfile`:
   - **`release`**: `python manage.py migrate --noinput && python manage.py seed_initial_data && python manage.py collectstatic --noinput`
     - `migrate` creates all tables.
     - `seed_initial_data` (see §5.1) populates the `Permission` rows, a default `AccessGroup`, and `DefaultSetting` rows the app depends on — **idempotent**, safe to run on every deploy.
     - `collectstatic` gathers static files for WhiteNoise to serve.
   - **`web`**: `gunicorn groupfund.wsgi --bind 0.0.0.0:$PORT --log-file -`
4. **Create your superuser** (one-time, after the first successful deploy) via Railway's shell/CLI:
   ```bash
   railway run python backend/manage.py createsuperuser
   ```
   (Or `railway shell` then `cd backend && python manage.py createsuperuser`.) This is the **only** way to create a superuser — there is no API endpoint for it (by design, see `accounts/permissions.py`).
5. Visit `https://<your-backend-domain>/admin/`, log in as the superuser, and configure real values for the `DefaultSetting` rows that were seeded with placeholders (bank details, PayPal email, contact info, visibility settings, etc.) — see §5.2.

---

## 5. Post-deploy configuration & known first-run gaps (now fixed)

During this audit, three **critical first-deploy gaps** were found and fixed — they're listed here so you understand what now happens automatically vs. what still needs a human.

### 5.1 Permission / AccessGroup / DefaultSetting seed data — `seed_initial_data`

**The gap:** nothing in the codebase ever created the `Permission` rows, the default `AccessGroup`, or the `DefaultSetting` rows that the application logic depends on (`core/models.py` only documented them in comments as "set via Django admin by superuser"). On a freshly-migrated production database, the **entire group-permission system would be empty** — no group could ever be granted `can_post`/`can_contribute`/etc., new member registration's default group would resolve to `NULL`, and every payment method would appear "unconfigured".

**The fix:** `python manage.py seed_initial_data` (wired into the `Procfile` release phase, runs automatically on every deploy) idempotently creates:
- All 11 `Permission` codenames referenced anywhere in the code (`can_contribute`, `can_comment`, `can_post`, `can_expense`, `can_view_balance`, `can_view_posts`, `can_view_dashboard`, `can_approve_comments`, `can_delete_member`, `can_change_any_password`, `can_manage_permissions`) with human-readable labels/descriptions.
- A default `AccessGroup` named **"Members"** (`is_default=True`), granted `can_contribute` + `can_comment` (the two permissions every group must carry per the contract documented in `accounts/models.py`).
- Every `DefaultSetting` key the codebase reads, with sensible defaults (see the command source for the full list — currency, visibility, payment-method toggles, etc.). Existing values are **never overwritten** — your changes via the admin persist across redeploys.

You can re-run it any time (`python manage.py seed_initial_data`) — it only fills in what's missing.

### 5.2 Things only a human can/should do after first deploy

- **Create the superuser** (§4 step 4) — required to access `/admin/` at all.
- **Review and fill in real values** for the seeded `DefaultSetting` rows via `/admin/core/defaultsetting/`:
  - `payment_manual_*` (bank name, account name/number, sort code) and set `payment_manual_enabled = true` once filled in, if you want to offer manual bank transfers.
  - `payment_paypal_*` (email, paypal.me link) and `payment_paypal_enabled = true`, if offering PayPal.
  - `default_currency`, `require_comment_approval`, `*_visibility` settings — adjust to taste.
  - `payment_stripe_*` / `payment_google_pay_*` are **placeholders reserved for Phase 10** — leave `enabled = false`; there is no working integration behind them yet (see §7).
- **Create your first `AccessGroup`s** (e.g. "Admins" with `can_manage_permissions`) and assign members to them via `/admin/accounts/accessgroup/` or the in-app admin panel (`/{locale}/admin/groups`).

### 5.3 CSRF / admin-panel POST-PATCH-DELETE requests — `CSRF_TRUSTED_ORIGINS`

**The gap:** Railway (and most PaaS) terminate TLS at a reverse proxy and forward requests over plain HTTP; `SECURE_PROXY_SSL_HEADER` (already configured) makes Django treat these as secure requests. Once `DEBUG=False` sets `CSRF_COOKIE_SECURE = True`, Django additionally validates the `Origin`/`Referer` header of every unsafe request (`POST`/`PUT`/`PATCH`/`DELETE`) against `CSRF_TRUSTED_ORIGINS` — which was previously **unset**. Without it, every Django-admin login and form submission in production would fail with `403 Forbidden (CSRF verification failed. Request aborted.)`.

**The fix:** `CSRF_TRUSTED_ORIGINS` now defaults to `https://` + each non-local entry in `ALLOWED_HOSTS` (see `settings.py:16-20`). You generally don't need to set it explicitly — just make sure `ALLOWED_HOSTS` lists your real production domain(s). Override via the `CSRF_TRUSTED_ORIGINS` env var (comma-separated, full origins **with scheme**) only if your setup needs something the auto-derivation doesn't produce (e.g. a different subdomain serving the admin).

### 5.4 Media storage (S3)

**The gap:** Railway's container filesystem is **ephemeral** — anything written to `MEDIA_ROOT` (uploaded post images, contribution/expense receipt images) is wiped on every redeploy or restart. Additionally, **nothing in the URLconf ever served `MEDIA_URL` → `MEDIA_ROOT`** — so even within a single running instance, uploaded images would 404 both locally (`runserver`) and in any production deploy that didn't configure S3.

**The fix (two parts):**
1. `groupfund/urls.py` now serves media:
   - In `DEBUG` mode (and no bucket configured): via Django's `static()` helper, like any standard Django project.
   - In production **without** a configured bucket: via a `django.views.static.serve` fallback, so uploads remain viewable out of the box (acceptable for low-traffic/testing, but **still ephemeral** — see below).
   - When `AWS_STORAGE_BUCKET_NAME` is set: media is served directly from the bucket/CDN; Django doesn't serve it at all.
2. **S3-compatible storage is wired up** (`django-storages` + `boto3`, `DEFAULT_FILE_STORAGE = storages.backends.s3.S3Storage`), activated by setting `AWS_STORAGE_BUCKET_NAME`. Supports AWS S3, Cloudflare R2, Backblaze B2, or any S3-compatible provider via `AWS_S3_ENDPOINT_URL`.

**What you should do:** for any real production launch with actual users uploading receipts/images, **set `AWS_STORAGE_BUCKET_NAME`** (+ credentials). If you skip this, the app still works, but uploaded files will be **lost on every redeploy** — acceptable only for a demo/testing environment.

> Remember to also set `NEXT_PUBLIC_MEDIA_URL` on the **frontend** to the bucket/CDN origin once you enable S3 — see §3.2 and §6 ("Image hostname not configured").

---

## 6. Step-by-step: deploying the frontend

The frontend has no Procfile because Next.js deploys differently per platform. Two common options:

### Option A — Railway (separate service, same repo)
1. Add a second service to the same Railway project, with **root directory = `frontend/`**.
2. Set build command: `npm install && npm run build`, start command: `npm run start`.
3. Set environment variables per §3.2 — at minimum `NEXT_PUBLIC_API_URL` pointing at your deployed backend's public URL.
4. **Important:** `NEXT_PUBLIC_*` variables are inlined into the JS bundle at **build time**. If you change `NEXT_PUBLIC_API_URL` (or any `NEXT_PUBLIC_*` var) after deploying, you must trigger a **rebuild**, not just a restart.

### Option B — Vercel (recommended for Next.js)
1. Import the repo into Vercel, set the project root to `frontend/`.
2. Set the same `NEXT_PUBLIC_*` environment variables (§3.2) in the Vercel project settings.
3. Deploy — Vercel handles build/start automatically.

Either way: **after the frontend is deployed, go back to the backend** and add the frontend's real public origin to `CORS_ALLOWED_ORIGINS` (and redeploy/restart the backend) — otherwise the browser will block all API calls with CORS errors.

---

## 7. What is *not* ready / explicitly deferred

- **Phase 10 — Stripe / Google Pay integration is NOT implemented.** `payments/factory.py` has `'stripe': None` (a placeholder), and `DefaultSetting` rows like `payment_stripe_*` / `payment_google_pay_enabled` are reserved placeholders, seeded with `enabled = false`. Do not enable them — there is no provider behind them; doing so would surface a broken payment option to users. This was a deliberate scope decision, not an oversight.
- **Local-disk media storage is ephemeral on Railway.** It now *works* (images render, both via Django's `static()` in dev and the `serve` fallback in prod), but uploads will be lost on every redeploy unless you configure S3 (§5.4).
- **The `/contact` page's "load contact email/phone from settings" path can never succeed for ordinary visitors** — it calls `GET /api/settings/`, which is gated to superusers only (`IsSuperuser`), and the `contact_email`/`contact_phone` keys it looks for aren't part of the seeded `DefaultSetting` set either (they were never part of the documented settings contract in `core/models.py`). In practice the page **always** falls back to its `mailto:` form — which still works fine, just isn't dynamically configurable from the admin. If you want this to be configurable, you'd need a small public (unauthenticated) settings endpoint exposing just those two keys, plus seeding them.

---

## 8. Common errors & how to fix them

| Symptom | Cause | Fix |
|---|---|---|
| `CommandError: You must set settings.ALLOWED_HOSTS if DEBUG is False` | `ALLOWED_HOSTS` not set in prod | Set `ALLOWED_HOSTS` to your real domain(s), comma-separated, no scheme. |
| Admin login / any admin form submit returns `403 Forbidden — CSRF verification failed. Request aborted.` | `CSRF_TRUSTED_ORIGINS` doesn't include your domain | Make sure `ALLOWED_HOSTS` lists the real domain (auto-derives the trusted origin), or set `CSRF_TRUSTED_ORIGINS=https://yourdomain.com` explicitly. |
| Browser console: `Access to fetch at '...' from origin '...' has been blocked by CORS policy` | Frontend origin missing from `CORS_ALLOWED_ORIGINS` | Add the frontend's exact origin (with scheme, no trailing slash) to `CORS_ALLOWED_ORIGINS` on the backend and redeploy. |
| Uploaded post images / receipts return `404 Not Found` at `/media/...` | Media not served (pre-fix bug) or wrong `MEDIA_ROOT`/storage config | Already fixed in `groupfund/urls.py` — confirm you're running the latest code. If using S3, confirm `AWS_STORAGE_BUCKET_NAME` + credentials are correct and the bucket is reachable. |
| `next/image` throws: `Invalid src prop ... hostname "..." is not configured under images in next.config.js` | Image is served from a domain not in `images.remotePatterns` (typically the S3 bucket/CDN domain when `AWS_STORAGE_BUCKET_NAME` is set on the backend) | Set `NEXT_PUBLIC_MEDIA_URL` on the **frontend** to that bucket/CDN's origin and **rebuild** the frontend. |
| New member registration succeeds but the member can't contribute/comment/do anything a "normal member" should be able to | `seed_initial_data` never ran, or the default `AccessGroup` isn't marked `is_default=True` | Run `python manage.py seed_initial_data` manually; check `/admin/accounts/accessgroup/` that exactly one group has "Is default" checked. |
| Admin panel shows payment method as "not configured" even though you filled in bank details | Forgot to flip `payment_manual_enabled` / `payment_paypal_enabled` to `true` after filling in the other fields | Edit the `*_enabled` `DefaultSetting` row to `true` via `/admin/core/defaultsetting/`. |
| `django.core.exceptions.ImproperlyConfigured: Set the AWS_STORAGE_BUCKET_NAME environment variable` (or similar from `boto3`) | Misconfigured/missing S3 credentials while `AWS_STORAGE_BUCKET_NAME` is set | Double check `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `AWS_S3_REGION_NAME` / `AWS_S3_ENDPOINT_URL` (only for non-AWS providers) are all correct for your bucket. |
| `relation "..." does not exist` after deploy | `migrate` didn't run, or the release phase failed before reaching it | Check the Railway "release" logs; re-run `python manage.py migrate --noinput` manually if needed. |
| `SECRET_KEY` warning in `manage.py check --deploy` (`security.W009`) | Using the default/weak `SECRET_KEY` | Generate and set a long random `SECRET_KEY`: `python -c "import secrets; print(secrets.token_urlsafe(64))"`. |
| Static files (admin CSS/JS, Jazzmin theme) missing/unstyled in production | `collectstatic` didn't run, or `STATIC_ROOT` not picked up by WhiteNoise | Confirm the release phase ran `collectstatic --noinput` successfully; WhiteNoise serves from `STATIC_ROOT` automatically once `STATICFILES_STORAGE` is set (already configured). |
| Frontend shows stale API URL / wrong backend after changing `NEXT_PUBLIC_API_URL` | `NEXT_PUBLIC_*` vars are baked in at **build time** | Trigger a full rebuild (not just a restart) of the frontend service after changing any `NEXT_PUBLIC_*` variable. |
| `psycopg2` / database connection errors on deploy | Wrong/missing `DB_*` vars, or DB not yet provisioned | Verify `DB_NAME`/`DB_USER`/`DB_PASSWORD`/`DB_HOST`/`DB_PORT` match your Postgres plugin's connection details exactly. |

---

## 9. Post-deploy smoke-test checklist

1. `GET https://<backend>/api/auth/...` returns JSON (not a CORS or 500 error) when called from the deployed frontend.
2. `/admin/` login works for the superuser, with no CSRF errors.
3. `/admin/core/permission/` lists all 11 seeded permissions; `/admin/accounts/accessgroup/` shows exactly one group with "Is default" checked.
4. Register a brand-new member from the frontend → confirm they land in the default group and can contribute/comment per its granted permissions.
5. Upload a post image (as a member with `can_post`) and confirm it renders on the frontend (tests both the backend media-serving fix and, if S3 is enabled, the `NEXT_PUBLIC_MEDIA_URL` `next/image` config).
6. Submit a contribution via each enabled payment method and confirm the instructions/receipt-upload flow completes.
7. Check `/admin/logs/activitylog/` and `/admin/logs/systemlog/` are populating as expected.
