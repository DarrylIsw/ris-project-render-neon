# Research Information System (RIS)

RIS is a role-based research administration web application for Universitas Multimedia Nusantara. It supports the full internal research lifecycle: scheme setup, proposal submission, verification, reviewer assignment and scoring, management decision, funded-research monitoring, reporting, researcher profiles, letters, external research reporting, archives, and in-app notifications.

This document is the primary handoff for the next developer or agent. Read it before changing workflows, state, permissions, or the database schema.

## 1. Current Project State

The running application requires PostgreSQL. React reads and writes through authenticated Express endpoints; server-side Prisma transactions persist per-entity RIS records and synchronize the relational tables. The previous browser gateway remains in the repository only for compatibility and a possible one-time import. It is not used by the running UI, and browser data is not silently merged into the database.

The existing `database.sql` schema was baselined into `prisma/migrations/0_init`. PostgreSQL-specific triggers, functions, views, and constraints remain SQL; Prisma handles application reads/writes and migrations. Email remains optional until SMTP is configured. Letter PDFs now use the supplied Word templates and external signing followed by signed-PDF upload; RIS does not create electronic signatures.

Authentication currently uses RIS-owned accounts. SSO is an integration placeholder only; no external identity provider is required to start the app.

## 2. Technology Stack

| Layer | Technology |
| --- | --- |
| Frontend | React 18, React Router, React Boilerplate conventions |
| UI | Custom reusable UI primitives, CSS/JSS, MUI, Lucide icons |
| Application persistence | Express REST API, Prisma 5, PostgreSQL per-entity and relational tables |
| Backend | Node.js, Express |
| Database | PostgreSQL through Prisma Client, with `pg` for existing SQL/email services |
| Authentication | Database-backed, HTTP-only session cookie and role/scope checks |
| Files | Private local or S3-compatible object storage behind authenticated download endpoints |
| Logging and audit | Pino, request context middleware, audit trail middleware |
| Validation | Joi |
| Documents | Docxtemplater + PizZip for Word letter templates; LibreOffice for PDF conversion; jsPDF for other existing document utilities |
| Testing | Mocha RIS unit tests, disposable PostgreSQL integration tests, ESLint |

## 3. Quick Start

### Prerequisites

- Node.js 18.18 or newer.
- npm 9 or newer.
- PostgreSQL 14 or newer with `pgcrypto`; it is required for normal operation.

### Install and run

~~~bash
npm install
npm start
~~~

The development application normally starts at http://localhost:3001. The UI and Express API use the same origin. Set `PORT` in `.env` if that port is occupied. Configure `DATABASE_URL` before starting.

### Important scripts

~~~bash
npm start             # Frontend development server and development entry point
npm run build         # Production frontend build
npm run build:dll     # Rebuild React Boilerplate DLL dependencies when needed
npm test              # RIS lint plus unit tests
npm run lint:ris      # Lint RIS source files
npm run test:unit     # Mocha RIS unit tests
npm run test:prisma   # Disposable PostgreSQL demo-seed integration test
npm run test:prisma:clean # Disposable clean-seed integration test
~~~

For a documentation-only edit, run:

~~~bash
git diff --check
~~~

## 4. Repository Map

~~~text
starter-project/
├── app/                                      # Frontend React sesuai struktur template
│   ├── components/                           # Komponen template yang dapat dipakai ulang
│   ├── containers/
│   │   ├── App/                              # Komposisi root dan entry router frontend
│   │   ├── LanguageProvider/                 # Provider bahasa template
│   │   ├── Pages/, Parent/, NotFound/        # Halaman bawaan template
│   │   └── Ris/                              # Aplikasi Research Information System
│   │       ├── index.js                      # Router dan shell RIS
│   │       ├── core/                         # Context, data, gateway, reducer
│   │       ├── shared/                       # UI dan workflow lintas fitur
│   │       └── features/
│   │           ├── auth/                     # Login dan autentikasi UI
│   │           ├── dashboard/                # Dashboard tiap role
│   │           ├── research/                 # Skema, proposal, review, pendanaan
│   │           ├── letters/                  # Katalog, pengajuan, penerbitan surat
│   │           ├── externalResearch/         # Pelaporan penelitian eksternal
│   │           ├── profiles/                 # Manajemen informasi peneliti
│   │           └── archive/                  # Arsip penelitian dan pengguna
│   ├── redux/                                # State Redux milik template
│   ├── utils/                                # Utilitas frontend template
│   ├── styles/                               # Gaya dasar template
│   └── api/                                  # Endpoint/aset API template
├── server/                                   # Backend Express
│   ├── config/                               # DB, Prisma, SMTP, argumen, port
│   ├── controllers/                          # Handler HTTP per domain
│   ├── models/                               # Query dan akses data per domain
│   ├── routes/                               # Registrasi endpoint API
│   ├── middlewares/                          # Auth, security, logging, audit, error
│   ├── services/                             # Layanan lintas alur bisnis
│   ├── dev/                                  # Pembaca sumber khusus tooling development
│   ├── templates/letters/                    # DOCX untuk penerbitan surat PDF
│   ├── observability/                        # Integrasi pelacakan error
│   └── index.js                              # Pembuatan Express app dan startup
├── shared/letterDocumentTemplates.js         # Metadata templat yang dipakai UI/server
├── prisma/                                   # Schema, migrasi, dan seed Prisma
├── database.sql                              # Bootstrap skema PostgreSQL dan seed
├── docs/reference/                           # Referensi endpoint historis, non-runtime
├── internals/                                # Konfigurasi Webpack dan skrip template
├── public/                                   # Aset statis frontend
├── test/ris/                                 # Pengujian alur RIS
├── .env.example                              # Contoh konfigurasi environment
├── index.js                                  # Entry server tingkat root
├── package.json                              # Skrip dan dependensi
└── README.md                                 # Panduan developer dan peta struktur
~~~

Di dalam container RIS, `core` menampung state dasar yang dipakai seluruh fitur, `shared` berisi komponen dan aturan bersama, sedangkan `features` memisahkan halaman, komponen, dan workflow menurut domain. Entry frontend berjalan dari `app/app.js` ke `app/containers/App/index.js`, lalu ke router RIS. Entry backend berjalan dari root `index.js` ke `server/index.js`.

## 5. Read These Files First

Before implementing a feature, understand these files in this order:

1. **app/containers/Ris/index.js**
   Routing, sidebar configuration, layout shell, and page entry points.
2. **app/containers/Ris/core/data.js**
   Demo entities and normalization helpers; the server imports fixtures only during initial seeding.
3. **app/containers/Ris/core/dataGateway.js**
   The live gateway calls `/api/auth` and `/api/ris/state`. The old local gateway is retained but inactive.
4. **app/containers/Ris/shared/workflows/workflow.js**
   Roles, per-admin scopes, menu visibility, action-level access, and manager mode switching.
5. **app/containers/Ris/shared/workflows/notificationWorkflow.js**
   In-app notification creation, deduplication, recipient logic, and toast behavior.
6. **docs/reference/productionDataApi.reference.js**
   A historical reference for future domain-specific APIs, not the active gateway.
7. **database.sql**
   Destructive bootstrap and relational seed source. Never rerun it against an existing deployment.
8. **server/index.js** and **server/routes/index.js**
   Current backend route registration and middleware order.

## 6. Runtime Architecture

~~~text
React pages/components
        |
        v
RIS workflow functions and serverDataGateway
        |
        v
Express session/scopes and /api/ris/state
        |
        v
Prisma transaction -> ris_records + relational tables -> PostgreSQL
        |
        +--> SQL triggers/functions and audit trail
        +--> private local / private S3-compatible uploads; optional SMTP worker
~~~

`RisContext` serializes optimistic saves and rejects stale revision writes. The server projects each role's visible state and validates changed domains before committing. Browser `localStorage` is used only for a UI preference and the inactive compatibility gateway; manager mode is a session preference.

## 7. Roles, Access, and Account Model

### Permanent account roles

| Role | Purpose |
| --- | --- |
| Super Admin | Full access to the entire system, all users, all administrative scopes, archives, and final decisions. |
| Manager | Management-level access comparable to Super Admin, plus a switchable lecturer view for personal lecturer workflows. |
| Admin | Scoped administrator. Each account may receive only research management, letter management, profile management, or a combination. |
| Lecturer | Researcher who manages profile information, submits proposals, performs funded-research obligations, requests letters, and reports external research. |

Student is no longer a supported permanent role. Reviewer is not a separate permanent role.

### Temporary reviewer assignment

Reviewer is an assignment granted to a lecturer for a particular review target:

- Internal research proposal.
- Monev submission or monitoring item.
- Final/interim report.
- Output report.

The lecturer keeps normal lecturer capabilities. The reviewer menu and review form appear only while an active assignment exists. The assignment is removed after the final administrative decision or when it is explicitly revoked.

The testing account **reviewer@umn.ac.id** represents lecturer **Dr. Andini Prameswari**. It becomes a reviewer only after an administrator assigns her to a relevant review target.

### Admin scopes

An Admin account can have one or more scopes. Sidebar menus and direct actions must both enforce them.

| Scope | Typical capabilities |
| --- | --- |
| Research management | Create schemes, verify proposals, assign reviewers, make or assist with decisions, manage funded research monitoring. |
| Letter management | Publish reusable letter types/forms, verify completed applications, request revisions or decline, and issue letters. |
| Profile management | Create and edit accounts, verify researcher profiles, deactivate eligible accounts. |

Super Admin and Manager have all scopes. Admin cannot manage a Manager account; Manager and Super Admin can manage all relevant accounts according to the business rules.

### Manager modes

Manager has two sidebar modes:

- **Management mode** provides management and administrative features.
- **Lecturer mode** provides the manager's own researcher, proposal, funded-research, letter-request, and external-report features.

The mode switch changes navigation only. It must not duplicate notifications or grant an unauthorised Admin scope. A Manager in lecturer mode can still create a letter request.

## 8. Testing Accounts

The active **database.sql** seed contains seven test accounts plus required reference catalogs, with no demo schemes, proposals, profiles, or sample workflows. Before running it, replace every `RIS_TEST_ACCOUNT_PASSWORD_CHANGE_ME` literal with a temporary testing password. Change those passwords after the first login. The separate Prisma demo seed remains for local development.

Representative accounts:

| Account | Intended use |
| --- | --- |
| superadmin@umn.ac.id | Full-system administration |
| manager@umn.ac.id | Management and lecturer-mode access |
| admin.penelitian@umn.ac.id | Research-management-only Admin |
| admin.surat@umn.ac.id | Letter-management-only Admin |
| admin.profil@umn.ac.id | Profile-management-only Admin |
| lecturer@umn.ac.id | Standard lecturer account |
| reviewer@umn.ac.id | Lecturer account for reviewer assignments |

Never reuse testing passwords outside this disposable testing deployment.

## 9. Core Domain Workflows

### 9.1 Research scheme and proposal lifecycle

Administrative users create a research scheme. A scheme can receive multiple proposals; it is not limited to one proposal or one lecturer.

Scheme setup includes:

- Title, description, year, opening and closing dates.
- Eligibility criteria for prospective research leaders.
- Maximum permitted budget.
- Reporting periods and deadlines.
- One required final report period only.
- Flexible interim-report periods.
- Output-report schedule.
- Required output types and field configuration.
- Proposal/RAB templates. Extra attachment settings remain in historical scheme records, but are no longer requested during proposal registration.

Lecturers browse all published schemes as an adaptive card catalogue:

- **Eligible schemes** show Detail and Register.
- **Catalogue schemes** remain visible but do not expose Register when the lecturer is not eligible.
- **Draft schemes** show a continuation action and a delete-draft action.
- **Funded research** moves out of scheme registration and into the funded-research area.

Proposal form steps:

1. Deskripsi Penelitian
2. Member
3. Anggaran
4. Luaran Hasil
5. Lampiran

The Anggaran step owns the RAB template download and required RAB upload, without a
manual RAB-total input. Previously recorded `requestedBudget` values remain in existing
records; otherwise totals derive from optional budget items. The uploaded spreadsheet
is not automatically parsed. Manual budget details are optional: `budgetSections` stores the
selected built-in or custom sections, and `budgets` stores their items. Removing a section
also removes its items, but does not remove the RAB. Any added items must be complete and
their sum cannot exceed the scheme maximum. The actual RAB must be checked during review.
Lampiran no longer repeats the RAB;
the registration attachment step now collects only Proposal Penelitian. Historical
extra attachment settings and previously uploaded files are retained for existing
records, but no longer add upload fields or block a proposal submission.

Draft input persists across navigation and browser refresh. A lecturer must be able to return to a draft, continue it, edit it, or delete it fully. A student cannot register a scheme because Student is no longer a supported role.

Proposal status flow:

~~~text
Draft
  -> Submitted / Menunggu Verifikasi
  -> Terverifikasi
  -> Menunggu Reviewer
  -> Direview
  -> Menunggu Keputusan
  -> Didanai

Alternative outcomes:
  -> Perlu Revisi
  -> Ditolak
~~~

Important rules:

- Reviewer scoring never automatically approves funding.
- After one or more reviewers submit, the proposal is **Direview**, not **Didanai**.
- Super Admin, Manager, or authorised Research Admin makes the final decision.
- A decision of approval moves the proposal to **Didanai**.
- The maximum budget comparison must accept an amount exactly equal to the configured maximum.
- Required outputs are configured by the scheme. A lecturer selects at least one available required output and may select more than one.
- Additional outputs are added or removed by the lecturer in the result/output step.
- Attachment rows are driven by the selected scheme configuration. Extra attachments are not lecturer-defined.

### 9.2 Proposal monitoring and decision

For Super Admin, Manager, and Admin with research-management scope, the main menu is **Manajemen Penelitian**. It contains:

- Daftar Skema
- Monitoring Penelitian
- Monitoring Penelitian Didanai

The scheme table supports **Hapus** with confirmation, only for research-scoped Admin, Super Admin, and Manager in management mode. `deleteResearchSchemeData` performs logical deletion (`deletedAt`, `deletedBy`), not a cascade delete. A scheme with any funded research or recorded funding decision cannot be deleted. Otherwise all related proposals, including drafts, become `archived` and remain in **Arsip** with their files, reviews, original status, and scheme references. Reviewer assignments are revoked and obsolete queued emails are cancelled. Deleted schemes and archived proposals are excluded from active lists and dashboards, including after reload. Archive edits cannot reactivate these proposals.

For the future database API, call `delete_research_scheme(scheme_id, authenticated_actor_id)`. It checks management permissions, locks the scheme, rejects funded research, archives proposals, revokes assignments, cancels obsolete queued emails, and records the audit entry atomically. Database triggers also coordinate proposal/funding writes with scheme deletion. Existing databases need an incremental migration, not a rerun of the destructive bootstrap.

**Monitoring Penelitian** opens at the Preview tab and has five tabs:

| Tab | Purpose |
| --- | --- |
| Preview | Submitted proposal list and read-only proposal preview. |
| Verifikasi | Completeness checking before reviewer assignment. |
| Reviewer | Assign one or more lecturer-reviewers, remind them, and inspect review results. |
| Keputusan | Final administrative decision after verification and review. |
| Pengumpulan Kontrak | Access to post-funding contract follow-up where relevant. |

The verification table tracks title, year, scheme, status, a verification action, and a read-only view. It must distinguish **Butuh Verifikasi**, verified, revision, and rejected states.

The reviewer table must support:

- Multiple reviewers per proposal.
- Searching/filtering lecturers eligible to review.
- Assigning and revoking reviewers.
- Temporary reviewer role activation.
- Reminder actions that create a notification and later can trigger email.
- Per-reviewer status.
- Viewing submitted scoring and comments.

The decision table includes proposal identity (title, leader, scheme), year, note, status, view, and a separate final-decision action. The final-decision modal must be the only place that changes a verified/reviewed proposal to funded, revision, or rejected.

### 9.3 Funded research and Pendataan Skema

When a proposal is approved, lecturer navigation changes:

- **Pengajuan Penelitian Internal** becomes a submenu:
  - Daftar Skema
  - Penelitian Didanai
- The funded item is no longer displayed as a registerable scheme.

The funded scheme card directs to **Pendataan Skema**. The page is organised like a section switcher, with:

1. Pengumpulan Kontrak
2. Monev
3. Laporan Akhir
4. Laporan Luaran

Rules for each section:

| Area | Lecturer action | Administrative action |
| --- | --- | --- |
| Contract | Upload/sign required contract documents | Review and publish signed contract material |
| Monev | View outcome and required follow-up | Assign reviewers, inspect results, issue the monev outcome |
| Final reports | Submit only during the open reporting period | Open, extend, review, assign reviewers, inspect results |
| Output reports | Submit scheduled outputs with mandatory/additional output data | Open, extend, review, assign reviewers, inspect results |

Monev is an administrative evaluation of the lecturer's research progress. Flexible Monev periods use the legacy `interim` database enum for compatibility, but they do not create lecturer interim-report obligations. The lecturer cannot edit the issued Monev result.

Monev and report review are separate from proposal review but use a similar temporary lecturer-reviewer model:

- Assign one or more reviewers to each target.
- Reviewer scoring forms differ by target type.
- Administrators can remind reviewers and view their results.
- Lecturer can view returned scores/comments but cannot alter reviewer data.

Suggested scoring dimensions already reflected in the UI direction:

- **Monev:** progress against plan, budget use, risks/mitigation, evidence quality, and next-period feasibility.
- **Final report:** achievement of objectives, methodology/results quality, consistency with proposal, budget accountability, documentation, and impact.
- **Output report:** output validity, metadata completeness, supporting evidence, and alignment with declared outputs.

Monitoring Penelitian Didanai uses a comprehensive table rather than progress cards. Do not reintroduce a generic progress bar to that table.

### 9.4 Letter request and issuance workflow

Lecturers and managers in lecturer mode submit letters. Super Admin, management-mode Manager, and Letter Admin configure the catalog, review applications, and issue letters.

Funded research is optional. Letters may concern research or unrelated academic/administrative activities, and the same user or research may have multiple applications.

Flow:

~~~text
Admin publishes a letter type, template and required fields
  -> lecturer chooses a published type
  -> fills the configured form (or saves a resumable/deletable draft)
  -> submits the complete application directly for verification
  -> admin requests correction, rejects, or issues the letter
  -> lecturer receives an in-app notification and optional queued email
  -> issued letter becomes downloadable by lecturer
~~~

Catalog administration is at **/ris/pengajuan-surat/jenis**; new applications start at **/ris/pengajuan-surat/new**. The older research-specific URL remains compatible. Catalog changes are versioned; applications retain their own field/template copies. Disabling a type prevents new applications but does not invalidate existing drafts or issued letters. Legacy request-first records retain their previous workflow so their history is not discarded.

The administrator's **Buat Surat** action opens a form builder initialized from **letterMasterTemplate**, with common recipient, activity, purpose, date, location and notes fields. **Master Template** edits the baseline for future letter types only. Fields can be renamed, added, removed, reordered and configured as text, long text, number, date/time, email or select. The lecturer preview uses the same field-rendering component as the real application form.

Template lifecycle: incomplete **draft**, **published**, **inactive**, or soft-deleted. Saving draft changes on a published type stores **pendingDraft** without changing the lecturer's published form. **Simpan dan Terbitkan** validates and releases the new version. Deleting a template immediately removes it from new lecturer applications while keeping previously saved applications and issued documents intact. Template statistics, status/category filters, search and application counts are available in the management table. Master and template edits are persisted only on explicit save, with navigation warnings for unsaved edits.

Implementation: `features/letters/workflows/letterCatalogWorkflow.js`, `features/letters/pages/`, and `features/letters/components/` under `app/containers/Ris/`. Mutations persist through the authenticated state API and are mirrored into `letter_definitions` and `letter_requests`. Do not rerun the destructive SQL bootstrap against an existing database.

Letter documents use the 21 supplied Word sources in **server/templates/letters/**. The authenticated backend fills DOCX placeholders with Docxtemplater and converts the result to PDF using LibreOffice. The form-builder editor selects a Word source and configures the issuing place, date and signer. Matching field keys fill existing placeholders; other populated fields appear in an **Informasi Tambahan** section before the closing/signature. Custom letters can use `template.values.customContent` with `{{fieldKey}}` placeholders. Applicant identity and issuing/signature metadata cannot be overwritten by lecturer form values. The original Word assets and logos are preserved.

Install LibreOffice on every application host (`sudo apt-get install libreoffice-writer` on Debian/Ubuntu, or the official Windows installer). `LIBREOFFICE_PATH` overrides automatic `soffice` discovery; optional `LETTER_PLACE`, `LETTER_SIGNER_NAME` and `LETTER_SIGNER_TITLE` provide server defaults. Missing conversion software produces a recoverable document error and does not block saving/submitting the application. Preview generation is explicit rather than per keystroke. PDF conversion uses isolated temporary profiles, a timeout, and a two-process concurrency limit.

Publication flow: lecturer submits data, management verifies/accepts, management generates/downloads an unsigned PDF, signs it outside RIS, uploads the signed PDF, then publishes it. Only the uploaded final PDF is available to the lecturer; unsigned drafts and their contents remain management-only. A source fingerprint prevents publishing a signed result against changed form/template data. Final publication uses the existing in-app notification and optional email outbox. Legacy demo letters with archive-only URLs are rendered as PDFs on demand, not TXT downloads; these demo PDFs are not evidence of a real signature.

Endpoints: `GET /api/letters/templates`, `POST /api/letters/preview`, `POST /api/letters/:id/generate-pdf`, `POST /api/letters/:id/publish-signed`, and `GET /api/letters/:id/pdf`. Draft generation and final publication are server transactions using the existing revision/conflict gateway. Stored PDFs use protected `stored_files` metadata and the configured local/S3 adapter; `?inline=1` enables an authenticated PDF viewer. Template source/issuer settings and generation fingerprints are stored in existing `ris_records` JSON. No new database columns are needed. For databases created before this change, the non-destructive compatibility query is **prisma/migrations/20261001_letter_word_pdf/migration.sql** (`prisma migrate deploy` for migration-managed installations). It updates only the template-format default/labels, without deleting or reseeding any data. Do not rerun `database.sql` on an existing database.

Letter statuses should clearly communicate the next actor, for example:

- Menunggu Verifikasi
- Ditolak
- Perlu Input Data (legacy applications)
- Data Dikirim
- Sedang Diproses
- Perlu Revisi
- Surat Tersedia

Draft letter requests may be edited or deleted. Do not show raw data keys such as **researchTitle**, **researchYear**, or **researchDuration** to end users; only human-readable Indonesian labels are allowed in UI.

### 9.5 External research reporting

External research reporting is a standalone main sidebar menu, not nested under the former general reporting menu.

The workflow covers:

- External research record creation.
- Progress/milestone information.
- Output reporting.
- Required attachment upload.
- Admin/manager validation and feedback.

Lecturers and Managers in lecturer mode use the same external-report page, including
create-report buttons, category choices, their own report history, editing and submission.
Manager lecturer mode does not expose other users' reports or administrative review actions.
Switching back to management mode restores the management queue and review actions, without
the create-report button. Super Admin and Admin retain management-only behavior here.
The user-facing labels must be Indonesian.

### 9.6 Researcher profile management

Lecturer and Manager-in-lecturer-mode see their own researcher profile and can edit it, including profile photo.

Profile Management Admin, Manager, and Super Admin see aggregate researcher management: counts, verification, account creation/editing, and account deactivation according to their permission rules.

The personal profile page must not show administrator-only metrics such as total profile, pending verification, verified, or incomplete. Those belong only in aggregate management views.

Account lifecycle expectations:

- Account creation has an intended role and, for Admin, one or more assigned scopes.
- Manager/Super Admin can create and manage scoped Admin accounts.
- Admin cannot deactivate a Manager.
- Manager can manage Admin accounts.
- Deactivation must deny future authenticated access without deleting audit history.
- Email notifications are optional and must not block the primary account action if email is not configured.

### 9.7 Archive

Super Admin and Manager have an **Arsip** menu at the bottom of the sidebar.

Archive is an administrative catalogue of:

- Research schemes and proposals.
- Funded research information.
- Researcher and account information.
- Relevant decision, contract, report, and output metadata.

Archive data must remain consistent with all newly added research and lecturer information. It is not an isolated copy of a few old fields. When a new domain entity is introduced, decide whether it belongs in the archive and add the corresponding read model or reference.

## 10. Sidebar and UI Behaviour

### Sidebar

- Sidebar menus are permission-driven. Never show a menu merely because a direct route exists.
- The sidebar supports collapse/expand with a slide animation.
- The burger control remains fixed near the collapsed sidebar position; it does not travel with the expanded sidebar.
- Fully collapsed mode hides all branding and menu contents, leaving only the burger control to restore it.
- Main content and responsive grids must reflow correctly in collapsed and expanded modes.
- Arsip is always the final visible administrative navigation item.
- Submenus must wrap and fit in narrow vertical space. Do not introduce horizontal scrolling to the sidebar.

### General layout

- Pages, forms, and management tables should use available viewport width rather than a narrow centred form column.
- No input label, help text, or card description may overflow, overlap, or be hidden behind a neighbouring card.
- Page section labels and helper descriptions must have independent vertical spacing.
- Use adaptive grids for scheme cards and responsive tables for dense operational data.
- Expanded scheme details use a darkened backdrop without blur. The backdrop prevents clicks outside the expanded view.
- Use Indonesian for user-facing UI: menus, buttons, statuses, forms, empty states, messages, and field labels.

### Form standards

Prefer structured input controls over manual free text:

| Data type | Preferred control |
| --- | --- |
| Year | Numeric stepper or year select |
| Reporting period/date | Date picker or start/end month selector |
| Duration | Start/end date or month fields, not manually typed prose |
| Enumerated status/category | Select, segmented control, checklist, or radio group |
| Multiple output choices | Checkbox/checklist |
| One required choice | Radio group/select |
| Budget | Currency input with number formatting and validation |
| Attachments | Named upload control with file state and delete action |

Use reusable components from **app/components/Ui.js** where possible. Avoid recreating slightly different cards, badges, modals, tables, stepper controls, and upload controls on each page.

## 11. Notifications and Email Readiness

### In-app notifications

The system uses three levels:

| Level | Use |
| --- | --- |
| Toast | Immediate result of an explicit action: save, submit, upload, delete, validation failure. |
| Notification centre/bell | Events initiated by another user, reminders, deadlines, and a persistent event history. |
| Blocking modal | Urgent action requiring acknowledgement, such as account deactivation or critical workflow expiry. |

Do not create a notification for each keystroke or field update. Proposal-update and letter-update notifications must occur only after an explicit save/submit action, and notification creation should be deduplicated.

High-value notification events include:

- Account creation, access-scope/role changes, and deactivation.
- Scheme opening for an eligible lecturer.
- Proposal submitted, revision requested, reviewed, rejected, or funded.
- Reviewer assignment, reminder, completion, revocation, and re-review.
- Contract availability and impending signature deadline.
- Reporting period opening, extension, deadline reminders, accepted/revision report outcome.
- Letter request state changes, required-data request, issuance, and document availability.
- External report validation/revision.
- Critical system integration failures.

Every actionable notification should link to the relevant record or screen, for example **Lihat Proposal**, **Beri Keputusan**, **Periksa Laporan**, or **Tanda Tangan**.

### Transactional email outbox

Email remains optional when SMTP is not configured, but when enabled it uses a
durable PostgreSQL transactional outbox. A business mutation, its in-app
notification, and new `email_outbox` rows commit together. SMTP is never called
inside that transaction. PostgreSQL `NOTIFY email_outbox_new` wakes the worker
immediately after commit; a 5-second fallback poll covers missed notifications
and worker restarts. The worker claims rows with `FOR UPDATE SKIP LOCKED`, sends
them through one pooled Nodemailer SMTP transport with bounded concurrency, and
records each recipient result as `sent`, `failed`, or `cancelled`.

Every new notification is eligible immediately after commit; there is no daily
digest schedule. Legacy queued digest rows are promoted to immediate delivery by
the worker without changing their deduplication keys or creating duplicate rows.
Failed delivery still uses exponential backoff, while stale `processing` locks
return safely to `queued`. This keeps delivery durable without blocking proposal,
letter, profile, or reporting mutations.

Relevant files:

- **app/containers/Ris/shared/workflows/emailNotificationWorkflow.js**
- **server/services/emailDeliveryService.js**
- **server/models/emailOutboxModel.js**
- **server/routes/emailRoutes.js**
- **.env.example**

Expected environment settings include SMTP host, port, username, password, sender
name/address, `EMAIL_QUEUE_FALLBACK_POLL_MS`, `EMAIL_QUEUE_BATCH_SIZE`,
`EMAIL_SEND_CONCURRENCY`, and `EMAIL_PROCESSING_TIMEOUT_MINUTES`. Missing SMTP
configuration results in a no-op/logged skip, never a broken proposal/letter/account workflow.

In development only, an authenticated management user may call
`POST /api/email/development/queue-test` with `{ "count": 1 }`, `{ "count": 5 }`,
or `{ "count": 20 }`. The response returns a run identifier and enqueue timing;
`GET /api/email/development/queue-test/:runId` reports first worker pickup, first
SMTP start, completion time, and completed count. Use `EMAIL_REDIRECT_ALL_TO` or
`EMAIL_RECIPIENT_ALLOWLIST` for this test. These endpoints are not registered in production.

## 12. Data and Persistence Boundary

### Current state

The live UI now uses database-backed state. Common entities include:

- Users, roles, admin scopes, profiles, photos, and account status.
- Schemes, schedule periods, eligibility criteria, output configurations, and attachment templates.
- Proposals, members, budgets, mandatory/additional outputs, attachments, drafts, and decisions.
- Reviewer assignments, scores, comments, and reviewer-status records.
- Funded research, contracts, Monev, final reports, and outputs.
- Letter requests, form-builder fields, user-filled values, and issued documents.
- External research reports.
- Notifications and archive records.

### Required implementation rule

Do not add direct `localStorage` persistence to page components. Existing `setData` mutations are persisted by `RisContext` through the authenticated API. Add domain-specific endpoints when a workflow needs stricter validation or better concurrency than the aggregate state gateway provides.

### Future API contract

**productionDataApi.reference.js** documents domain-specific endpoint ideas. It is reference material, not active frontend runtime code. The active aggregate gateway already saves to PostgreSQL; the next step is to replace coarse aggregate writes with narrower command endpoints one domain at a time.

Recommended domain API refinement order:

1. Authentication, user identity, roles, scopes, and active/deactivated access.
2. Researcher profile read/update and account administration.
3. Scheme creation/listing/detail.
4. Proposal drafts, submit, verification, reviewer assignment, and final decision.
5. Funded-research contracts, Monev, final reporting, and outputs.
6. Letter workflow and document generation.
7. External reporting.
8. Notifications, email delivery, archive read models, and real-time updates.

Do not reintroduce a second source of truth for one screen. The database must remain authoritative across roles.

## 13. Backend API Foundation

The Express server has a layered structure:

~~~text
React -> Express route -> Prisma service/transaction -> PostgreSQL
~~~

Routes are registered from **server/routes/index.js** and mounted by **server/index.js**. Current API groups include:

| Endpoint prefix | Domain |
| --- | --- |
| /api/research | Schemes, proposals, funded research, reviews, reports |
| /api/letters | Letter workflow |
| /api/external-research | External research reporting |
| /api/researcher-profiles | Researcher profiles and account-related data |
| /api/email | Optional email readiness/integration endpoint |
| /api/auth | Cookie login, session, and logout |
| /api/ris/state | Scoped application state GET and transactional PUT |
| /api/files | Authenticated private upload and download via the configured storage adapter |

Server responsibilities already present or expected:

- Request ID creation and propagation.
- Structured request logging.
- Optional current-user extraction until full authentication middleware replaces it.
- Central validation and error responses.
- Audit-trail records for sensitive mutations.
- Parameterized SQL only. Never concatenate user input into SQL.

When adding an endpoint:

1. Define validation in the controller.
2. Apply authorization using the same roles/scopes as the frontend.
3. Use a model function with parameterized SQL.
4. Wrap multi-table state transitions in a database transaction.
5. Add audit logging for sensitive changes.
6. Return a stable response shape documented in the data gateway/reference file.
7. Add tests for both success and forbidden/invalid cases.

## 14. Database Schema and Seeds

**database.sql** is the destructive bootstrap and clean testing seed. The Render startup validates its seven-account contents, applies the incremental Prisma migrations, then initializes only the matching empty runtime state. The first Prisma migration is the baseline of the SQL schema, including PostgreSQL functions/triggers/views; later migrations add runtime records and revision tracking. Prisma and the existing `pg` email/SQL services use the same database.

For an **existing database already created with `database.sql`** (the current local setup), retain all data. After configuring `DATABASE_URL`, run this once if the baseline is not already recorded, then deploy incremental migrations:

```sh
npx prisma migrate resolve --applied 0_init
npm run db:prisma:migrate
npm run db:prisma:generate
```

Do not rerun `database.sql`, call `prisma migrate reset`, or reseed this database. On first server access, an exact demo seed (9 users, 7 schemes, 5 drafts), clean seed (2 users, no schemes/drafts), or clean testing seed (7 accounts, no schemes/drafts) is checked before the matching minimal runtime state is initialized. Other counts fail closed rather than overwriting data. Render applies pending migrations from its direct PostgreSQL URL before starting Express. Browser `localStorage` is preserved but **not** automatically imported; use an explicit, reviewed migration if old browser edits must be retained.

For a **new empty database**, run `npm run db:prisma:migrate`, then `npm run db:prisma:seed` for the demo or `npm run db:prisma:seed:clean` for only Super Admin/Manager. Clean seeding requires `RIS_BOOTSTRAP_SUPERADMIN_PASSWORD` and `RIS_BOOTSTRAP_MANAGER_PASSWORD` (12+ characters) as private environment variables. Run only one seed mode, and never seed over existing data.

The active SQL seed inserts only reference catalogs, seven accounts, admin scopes, and the matching empty runtime projection. All seven accounts use the same placeholder password string in the generated SQL; replace it everywhere before execution. **Warning:** the root bootstrap executes `DROP SCHEMA public CASCADE`. Use it only on a new/disposable database, never as an upgrade script. Testing uploads use the private object-storage bucket; local development uses `var/uploads`.

The generated seed uses stable, parent-scoped UUIDs rather than frontend IDs such as `scheme-1`. The current API reconstructs its UI shape from `ris_records` and writes through to relational tables with `id(domain, key)` in `internals/scripts/generate-database-seed.js`. A future relational-read refactor must preserve this mapping; naive copies of browser IDs into UUID columns will not work.

File names, sizes, types, supplied URLs, and actual inline demo template contents are preserved. Demo documents without real bytes remain **pending placeholders**, not invented PDF/Excel files. The seeded funded-review total and individual scores are preserved exactly as supplied by `data.js`, even where its demo total differs from recalculation; new API review submissions must calculate totals server-side.

Maintain and verify the seed with:

```sh
npm run db:seed:generate
npm run db:seed:check
npm test
```

The generator rewrites only the generated seed section in `database.sql`, leaving the schema above it intact. Do not edit generated INSERTs manually. A unit test detects drift from `data.js`.

Database tests require a local PostgreSQL login with `CREATEDB` permission. `npm run test:db` validates the root SQL schema/seed; `npm run test:prisma` and `npm run test:prisma:clean` create and remove separate randomly named databases via `DATABASE_URL`, deploy migrations, seed, and exercise transactions/auth/file storage. They never reset the database named in `DATABASE_URL`. `test:db` additionally reads `RIS_TEST_POSTGRES_URL` (not `.env`):

```powershell
$env:RIS_TEST_POSTGRES_URL = 'postgresql://postgres@127.0.0.1:55439/postgres'
npm run test:db
npm run test:prisma
npm run test:prisma:clean
```

Published schemes require exactly one final reporting period at transaction commit; schedule replacements must be transactional. Reports/Monev must reference the correct research and period, and output reports must reference an output of that same proposal. Partial wizard data can remain in `research_drafts.payload` before validated child rows exist; archive queries include those incomplete drafts.

The schema should represent the following relational concepts:

- Roles, users, role scopes, account state, and researcher profiles.
- Research schemes, eligibility rules, schedules, output requirements, and attachment requirements.
- Proposals, members, budgets, outputs, attachments, lifecycle events, and decisions.
- Review assignments, review criteria/scores, comments, reminders, and assignment completion.
- Funded research, contracts, Monev, final reports, outputs, deadlines, and extensions.
- Letter requests, requested fields, submitted values, documents, and workflow state.
- External research records and attachments.
- Notifications, audit events, and archive-compatible references.

Do not casually alter seed IDs, foreign keys, enum/check values, or status names. The frontend demo state and migration reference may rely on them. Add an explicit migration file for production schema evolution instead of repeatedly editing an already deployed bootstrap script.

## 15. Environment Variables

Copy **.env.example** to **.env** for local development and fill only the services you will actually run. For Render + Neon testing, use **.env.render.example** as a key checklist and follow **docs/deployment/render-neon.md**. Do not upload local `.env` files to hosting; configure secrets in the hosting platform's environment settings.

Typical groups:

| Group | Examples |
| --- | --- |
| Server | PORT, NODE_ENV, HOST, APP_BASE_URL, TRUST_PROXY_HOPS |
| PostgreSQL | DATABASE_URL (Prisma pooled connection); DATABASE_URL_UNPOOLED (direct connection for migrations and `pg` LISTEN/NOTIFY); local PGHOST/PGDATABASE/PGUSER/PGPASSWORD |
| Files | FILE_STORAGE_BACKEND (`local` or `s3`), FILE_STORAGE_DIR, FILE_STORAGE_BUCKET, AWS_ENDPOINT_URL_S3, AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY |
| Email | EMAIL_ENABLED, EMAIL_FROM, SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, EMAIL_QUEUE_FALLBACK_POLL_MS, EMAIL_QUEUE_BATCH_SIZE, EMAIL_SEND_CONCURRENCY |
| Logging | SERVICE_NAME, SENTRY_DSN (optional until an error-monitoring project is provisioned) |
| Bootstrap | RIS_BOOTSTRAP_SUPERADMIN_PASSWORD, RIS_BOOTSTRAP_MANAGER_PASSWORD (clean seed only) |
| Security | MFA_ENCRYPTION_KEY (32 random bytes encoded as 64 hex characters) |

Never commit real credentials. **.env** should be ignored by Git; **.env.example** should only contain harmless placeholders.

Email uses PostgreSQL `email_outbox` and a near-real-time background worker, with SMTP as its sole delivery transport. Configure the SMTP relay host, port, login/password, a verified sender address, `APP_BASE_URL`, and TLS. Brevo API credentials are not used; when using Brevo, configure its SMTP relay credentials instead. SMTP embeds the UMN logo in each message. `EMAIL_REDIRECT_ALL_TO` redirects every notification to one inbox, while `EMAIL_RECIPIENT_ALLOWLIST` restricts delivery to listed addresses. For local testing with real registered account addresses, leave both empty and explicitly set `EMAIL_ALLOW_DIRECT_DELIVERY=true`. PostgreSQL `LISTEN/NOTIFY` handles normal wake-up; `EMAIL_QUEUE_FALLBACK_POLL_MS=5000` is only a recovery path. A worker claims up to `EMAIL_QUEUE_BATCH_SIZE=25` records and sends at most `EMAIL_SEND_CONCURRENCY=5` SMTP groups at once. The worker retries delivery failures and cancels queued mail older than `EMAIL_MAX_AGE_HOURS` (72 hours by default). Email delivery does not block proposal, letter, profile, or report updates.

### Production security setup

Run `prisma/migrations/20261001_security_mfa/migration.sql` on a database previously created directly from `database.sql`; do not rerun the full bootstrap SQL. Migration-managed databases use `npm run db:prisma:migrate`. Keep the same `MFA_ENCRYPTION_KEY` on every application instance and in backups; losing it makes enrolled TOTP secrets unreadable. Generate a key with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` and store it only in the server environment.

Set `NODE_ENV=production` and `APP_BASE_URL` to the site's exact HTTPS origin (scheme, hostname, optional public port, and no path). Plesk Node.js runs through Passenger and supplies the app port, so the production process requires `PORT` from Passenger; it does not fall back to a fixed port. Leave `HOST` unset for Passenger. If using a different reverse-proxy setup, set `HOST` only to a private/loopback address. Set `TRUST_PROXY_HOPS` to the number of trusted proxy hops that pass `X-Forwarded-Proto`; confirm the chain with IT because HTTPS redirects, secure cookies, and same-origin checks depend on it. Keep direct access to the Node process closed. The server redirects HTTP to the canonical HTTPS origin, sets HSTS and security headers, restricts browser origins to the canonical origin, and rate-limits login, uploads, PDF conversion, exports, and all API requests. The React app uses same-origin requests, so CORS is intentionally not enabled. Configure WAF and DDoS protection at the proxy/CDN; these cannot be installed by Express middleware.

For PostgreSQL, set `DATABASE_SSL=true` in production. The Prisma connection URL is normalized to `sslmode=require`; unless `DATABASE_SSL_REJECT_UNAUTHORIZED=false` is explicitly set, Prisma also uses `sslaccept=strict`. Provide the database CA certificate when the host uses a private CA. Do not turn off certificate validation just to bypass a connection error; ask IT for the correct CA/SSL settings.

### Render + Neon testing

This copy is configured as one Docker-based Render Web Service in Singapore. The container serves the production React build and Express API, with LibreOffice installed for document conversion. Neon PostgreSQL backs the app; private Neon Object Storage stores file bytes. Downloads pass through authenticated `/api/files/:id` authorization and never expose public object URLs. Object keys are grouped by purpose (`proposals/`, `rab/`, `profiles/`, `contracts/`, `reports/`, `letters/`, and `external-research/`).

Follow **[docs/deployment/render-neon.md](docs/deployment/render-neon.md)**. Use Neon pooled PostgreSQL URL as `DATABASE_URL` and its direct/unpooled URL as `DATABASE_URL_UNPOOLED` for migrations and PostgreSQL notifications. Only run `database.sql` on a new disposable Neon database, after replacing every test password placeholder. Never run the destructive bootstrap on an existing database.

### Plesk Node.js settings

Use the repository root as the application root and `index.js` as the startup file. Set the Node.js application mode to **Production** and run the production frontend build during deployment so Express can serve `build/`. Passenger provides `PORT`; do not pin a port in Plesk. Add the production values from **.env.production.example** in Plesk's environment-variable settings, including `APP_BASE_URL`, `TRUST_PROXY_HOPS`, `DATABASE_URL`, and `MFA_ENCRYPTION_KEY`. Use an explicit `DATABASE_URL` because Prisma Migrate needs it too; encode reserved characters in the username/password. Keep `HOST` unset. Ensure `FILE_STORAGE_DIR` points to a persistent directory writable by the app user and outside any directory served as public static files. Enable HTTPS for the domain in Plesk and ask IT to verify that the trusted proxy forwards the original scheme before enabling production traffic.

Admin, manager, and super-admin accounts enroll a TOTP authenticator at their first production login. They receive no session until a valid code is submitted; previously created sessions without MFA are rejected. A help-desk or DBA must verify identity before clearing a lost authenticator. Production startup refuses demo accounts still using the bundled password. Rotate those passwords and use a clean seed for new installations. Cookie sessions are `HttpOnly`, `Secure`, and `SameSite=Lax`; the production cookie uses the `__Host-` prefix.

CI runs `npm run security:audit` after build; the production dependency audit currently reports zero known vulnerabilities, and the full dependency audit has no high or critical advisories. Moderate advisories remain in optional development tunnel and PWA image tooling; review them before enabling those workflows on untrusted inputs. Logging records request IDs and action metadata without whole request bodies, query strings, or raw emails. Set `SENTRY_DSN` to enable centralized server error tracking; only synthetic error type/code and request ID are sent, never raw exception messages or request data. Without a DSN, structured JSON logs still go to stdout and must be collected and alerted on by the server platform. Configure retention and alert ownership with IT.

The repository `.npmrc` uses `legacy-peer-deps=true` because dormant template packages declare React peer versions older than this application's React 18. Keep that setting for reproducible `npm ci` installs until those packages are removed or upgraded.

## 16. Observability and Audit Trail

The backend is prepared for structured logs, request identifiers, and audit records. Preserve that direction during integration.

Sensitive actions that require audit events:

- Account creation, update, scope change, deactivation, and reactivation.
- Scheme creation/edit/publish/close/reopen.
- Proposal verification, reviewer assignment/revocation, decision, revision request, and funding.
- Contract publication/signing actions.
- Reporting-period open, extend, close, review, and final disposition.
- Letter acceptance/decline, field-builder changes, issuance, and document replacement.
- Archive edits.
- Email/PDF service failures that affect a requested user action.

Each audit record should include actor, action, entity type, entity ID, timestamp, request ID, before/after summary where appropriate, and source context. Do not put passwords, secrets, full tokens, or unnecessary sensitive attachment contents into logs.

## 17. Testing Expectations

Run focused checks during development and the full suite before handoff.

Minimum checks:

~~~bash
npm run lint:ris
npm run test:unit
npm run build
git diff --check
~~~

High-risk workflow changes need manual role-based verification:

1. Log in as each demo role.
2. Verify only permitted sidebar menus are visible.
3. Attempt a prohibited direct route/action and confirm it is denied or redirected.
4. Create or update a record and confirm linked views for another role reflect the same state.
5. Test draft persistence, continuation, and deletion.
6. Test reviewer assignment, review submission, and final decision separately.
7. Test scheme reporting deadlines and administrator reopen/extend actions.
8. Test responsive layout with sidebar expanded and collapsed.

For backend changes, add API tests covering:

- Validation failures.
- Missing/invalid identity.
- Forbidden scopes.
- Cross-account data access attempts.
- State transition rules.
- Transaction rollback where an operation has multiple writes.

## 18. Development Conventions

- Use ASCII by default in code files unless the file already requires another character set.
- Use Indonesian for all end-user text. English is acceptable in code identifiers, comments, README, and technical logs.
- Reuse existing UI primitives and local patterns before introducing new abstractions.
- Prefer Lucide icons for icon buttons.
- Keep cards compact with modest border radius. Do not nest decorative cards inside cards.
- Prefer explicit state machines/status constants to scattered string comparisons.
- Keep status labels separate from status codes so UI language changes do not break logic.
- Keep API/database field names stable and map them to Indonesian labels in UI.
- Do not add a broad refactor while implementing a narrow workflow fix unless it is necessary for correctness.
- Do not delete or reset unrelated user changes in a dirty worktree.

## 19. Safe Change Checklist for Agents

Before changing a workflow:

1. Identify the entity in **data.js** and its gateway methods.
2. Search for all references to its status/type values.
3. Inspect sidebar permissions and route guards for every affected role.
4. Check dashboards, archive, notifications, and related role views for the same entity.
5. Check whether the SQL schema and API reference need a matching update.
6. Implement the mutation through the data gateway.
7. Add a notification only for meaningful workflow events, not field-level editing.
8. Verify the primary action still works when email/PDF/backend configuration is absent.
9. Run targeted tests and role-based smoke checks.

Before merging:

1. Confirm the UI contains no raw field keys, English labels, overflow, or horizontal sidebar scroll.
2. Confirm administrative actions remain restricted by both menu visibility and action checks.
3. Confirm manager mode does not lose valid lecturer capabilities.
4. Confirm archived views still see new relevant data.
5. Confirm demo records remain consistent across roles.

## 20. Known Boundaries and Recommended Next Work

### Deliberately incomplete production integrations

- The database is authoritative, but the current aggregate PUT endpoint writes a per-entity UI projection and mirrors relational tables. Replace it gradually with smaller validated domain commands and relational reads before high-concurrency production use.
- Login has database-backed HTTP-only sessions and server-side role checks. Add password reset/rotation, login rate limiting, CSRF hardening, and account recovery before public deployment.
- SMTP is configured through local environment variables. The dedicated server needs its own verified sender and SMTP credentials.
- Other document domains still need their own preview/rendering integration; letter previews and downloads already use PDF.
- File uploads can use private local storage or a private S3-compatible bucket, with database metadata and authenticated downloads. Add malware/content inspection, storage quotas, backups, and retention policies before public deployment.
- Notifications and the email outbox are persisted in PostgreSQL. Email delivery is already a near-real-time transactional outbox worker using PostgreSQL `LISTEN/NOTIFY`, durable recovery polling, and SMTP pooling. Browser real-time push remains future work.

### Recommended improvements before or during the backend rework

1. Replace the aggregate state PUT with domain-specific commands, server-side validation, and relational reads.
2. Add a shared typed domain/status layer to reduce duplicated string values.
3. Add password reset/rotation, login throttling, and tighter request-level access tests.
4. Configure managed private object storage for hosted deployments; keep database metadata and authenticated access.
5. Continue Prisma migrations for application tables and SQL migrations for PostgreSQL-specific features.
6. Extend template/PDF rendering to decision documents and other document domains; verify external signature provenance as needed.
7. Add a background job/queue for email, deadline reminders, PDF creation, and retry handling.
8. Add pagination, server-side filtering, and indexing for large archive/monitoring tables.
9. Add end-to-end tests for the cross-role proposal, review, funded-reporting, and letter flows.
10. Add accessibility checks: keyboard navigation, focus restoration in modals, labels, contrast, and screen-reader semantics.

## 21. Suggested Agent Brief

Use the following context when delegating work:

> This is a React + Express + Prisma/PostgreSQL Research Information System. The UI uses authenticated database-backed APIs and a transactional aggregate state gateway; the legacy browser gateway is inactive. Read app/containers/Ris/index.js, app/containers/Ris/core/data.js, app/containers/Ris/core/RisContext.js, app/containers/Ris/shared/workflows/notificationWorkflow.js, server/services/risStateMutation.js, prisma/schema.prisma, and database.sql before changing workflows. Permanent roles are Super Admin, Manager, scoped Admin, and Lecturer; Reviewer is a temporary assignment granted to a lecturer. Manager has switchable management and lecturer sidebars. Proposal reviewer scoring never funds a proposal by itself: verification, scoring, and final administrative decision are separate. A research scheme can have multiple proposals. Enforce scopes on server mutations as well as menus. Keep UI labels Indonesian and responsive; optional email/PDF must never block core workflows. When adding an entity or status, update all role views, notification behavior, archive visibility, seed parity, relational write-through, migrations, and tests.

## 22. Handoff Notes

The application has grown through iterative product work. PostgreSQL is now the source of truth; preserve that while replacing broad aggregate writes with narrower domain endpoints incrementally. Prove each domain with cross-role and transactional tests.

Keep the workflow rules above intact unless product requirements explicitly change them. They are the contract that keeps lecturer, reviewer, admin, manager, super-admin, dashboard, notification, and archive views aligned.
