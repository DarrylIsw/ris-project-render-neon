# Testing Deployment: Render + Neon

This deployment keeps the React production build, Express API, Prisma, and LibreOffice in one Docker Web Service. Neon PostgreSQL stores relational data; a private Neon Object Storage bucket stores uploaded bytes. Browser downloads continue through authenticated `/api/files/:id` routes, so the bucket is never exposed as a public URL.

## Folder Map

```text
ris-project-render-neon/
  app/                         React application source
  server/                      Express API, Prisma services, and templates
    services/fileStorage/      Local and S3-compatible storage adapters
  prisma/                      Prisma schema, migrations, and seed scripts
  public/                      Static public assets
  var/uploads/                 Local-only upload storage for development
  database.sql                 Fresh-database bootstrap and account-only seed
  Dockerfile                   Production image with LibreOffice
  internals/scripts/start-render.js  Seed guard, Prisma migrations, and app startup
  render.yaml                  Render Blueprint for the Singapore test service
  .env.render.example          Environment variable reference; no live secrets
  docs/deployment/             Deployment notes and setup sequence
```

## Neon Setup

1. Create a new disposable Neon project/branch for testing. Select the Singapore region for PostgreSQL if that is the intended data region.
2. Create a PostgreSQL database and copy both connection strings from Neon: the pooled connection for Prisma and the direct/unpooled connection for `DATABASE_URL_UNPOOLED`.
3. Enable Neon Object Storage for the branch and create a bucket named `ris-testing-files` with access level **private**. Do not make it `public_read`.
4. Copy the branch's S3 credentials and endpoint into Render: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_ENDPOINT_URL_S3`, and `AWS_REGION`. Use the exact values shown by Neon. Neon S3 requests require path-style addressing; the adapter configures this.
5. Run `database.sql` once against the new, empty Neon database. This bootstrap drops and recreates the `public` schema; never run it against an existing database with data to keep.
6. Before execution, replace every `RIS_TEST_ACCOUNT_PASSWORD_CHANGE_ME` literal in the SQL file with a temporary strong password. The seed has seven accounts and no sample research records. Reviewer is a lecturer account; reviewer menus become available after an administrator assigns a review.

Neon Object Storage's available region can depend on the project/branch and current Neon service availability. Confirm the storage endpoint and region in the Neon console instead of assuming that the PostgreSQL region and object-storage region are identical.

## Render Setup

1. Push this folder as the repository root to a Git provider and connect that repository to Render. The Render service root must contain `Dockerfile`, `render.yaml`, `package.json`, `server/`, and `app/`.
2. Create the service from the Blueprint in `render.yaml`. It selects Render Singapore, Docker, and `/api/health` as the health check.
3. Fill the prompted environment secrets. Set `APP_BASE_URL` to the service's final HTTPS `onrender.com` URL; confirm and update it if Render assigns a different slug after creation. Use Neon pooled `DATABASE_URL` for normal Prisma application queries and direct `DATABASE_URL_UNPOOLED` for migrations and the Node PostgreSQL pool (`LISTEN/NOTIFY`).
4. Generate `MFA_ENCRYPTION_KEY` locally with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. Keep it in Render only; do not commit it.
5. Keep `EMAIL_ENABLED=false` for the first smoke test. Add verified SMTP settings later if notification emails should be exercised.
6. Deploy. Startup verifies the clean seven-account seed, marks the initial SQL schema baseline once, applies pending Prisma migrations using the direct database URL, and only then starts Express. It refuses to alter migration history if the database contains other users, schemes, drafts, or unexpected migration records.
7. Verify `https://YOUR-RENDER-SERVICE.onrender.com/api/health`. Then test login, authenticated file upload/download, and letter PDF generation.

Render's free service can sleep while idle and has limited CPU/RAM. Its regular filesystem is ephemeral, which is why uploads must use `FILE_STORAGE_BACKEND=s3`; do not add a local-disk fallback in this deployment. LibreOffice is included in the Docker image for PDF generation.

## Required Render Variables

| Variable | Value/source |
| --- | --- |
| `APP_BASE_URL` | Final HTTPS Render URL |
| `DATABASE_URL` | Neon pooled PostgreSQL URL |
| `DATABASE_URL_UNPOOLED` | Neon direct PostgreSQL URL |
| `AWS_ACCESS_KEY_ID` | Neon Object Storage credential |
| `AWS_SECRET_ACCESS_KEY` | Neon Object Storage credential |
| `AWS_ENDPOINT_URL_S3` | Neon branch S3 endpoint |
| `AWS_REGION` | Region value from Neon |
| `MFA_ENCRYPTION_KEY` | Random 32-byte hex secret |

`FILE_STORAGE_BACKEND=s3`, `FILE_STORAGE_BUCKET=ris-testing-files`, TLS database verification, proxy trust, and email-off defaults are supplied by `render.yaml`.
