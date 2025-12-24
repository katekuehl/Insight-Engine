# TODO

## High Priority

- [ ] Fix local Postgres setup so `psql "$DATABASE_URL" -f database/schema.sql` succeeds.
- [ ] Create a `.env` file at repo root with `DATABASE_URL` and (optionally) `ANALYTICS_PORT`.
- [ ] Verify `pip3 install -r requirements.txt` succeeds on your machine (may take a while because of `torch`, `prophet`, etc.).
- [ ] Start the FastAPI service and validate:
  - [ ] `python3 -m uvicorn main:app --reload --port 8000`
  - [ ] `GET /health`

## Medium Priority

- [ ] Add a minimal pytest suite:
  - [ ] Unit tests for `connectors/csv_importer.py` parsing helpers.
  - [ ] Unit test that `loaders/data_loader.get_connection()` errors when `DATABASE_URL` is missing.
  - [ ] Smoke test that `analytics_service.main` imports cleanly from repo root.

## Cleanup / Quality

- [ ] Decide whether to keep `analytics_service/requirements.txt` in sync manually or generate it from `pyproject.toml` (to prevent drift).
- [ ] Consider raising HTTP status codes (`HTTPException`) instead of always returning `success=False` with 200 in the analytics service.
- [ ] Consider adding logging (structured logs) for operator execution errors.

## Security

- [ ] Add auth/authz checks to server routes that accept `:orgId` / `:userId` params to prevent IDOR (insecure direct object reference).
- [ ] Add rate limiting on auth- and invite-related endpoints (register, sync, invite create/accept) to reduce brute force / abuse.
- [ ] Review request/response logging in `server/index.ts` (currently logs full JSON bodies); redact tokens/secrets/PII before logging.
- [ ] Add CORS policy explicitly for API routes (restrict origins, methods, headers) rather than relying on defaults.
- [ ] Consider CSRF protections if using cookie-based sessions for authenticated API calls.
- [ ] Audit `dangerouslySetInnerHTML` usage (`client/src/components/ui/chart.tsx`); ensure injected values cannot be user-controlled or sanitize inputs.
- [ ] Ensure secrets are only read from environment variables and never committed (Stripe/Supabase keys); add a pre-commit/CI secret scan.

## Nice to Have

- [ ] Add a `Makefile` or `justfile` with common commands (install, run service, run pipeline, load schema).
- [ ] Add CI workflow to run lint + tests.
- [ ] Switch to `uv` for speedier dependency installation.