-- RIS LPPM PostgreSQL bootstrap
-- Target: PostgreSQL 13+
--
-- Create and select the target database before running this file:
--   createdb ris_lppm
--   psql -v ON_ERROR_STOP=1 -d ris_lppm -f database.sql
--
-- WARNING: this bootstrap resets the public schema and deletes existing data.
-- Use a migration tool for incremental changes after the first deployment.
-- Seed A is generated from normalizeRisData(createInitialData()), not browser storage.
-- To install without demo data, replace the entire SEED A block with SEED B.
-- Do not append Seed B after Seed A. Both use the surrounding transaction.

BEGIN;

DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
SET search_path TO public;
SET TIME ZONE 'Asia/Jakarta';

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;

-- ---------------------------------------------------------------------
-- Enumerations
-- ---------------------------------------------------------------------

CREATE TYPE role_type AS ENUM (
  'super_admin',
  'manager',
  'admin',
  'lecturer'
);

CREATE TYPE admin_scope_type AS ENUM (
  'research_management',
  'letter_management',
  'researcher_profile_management'
);

CREATE TYPE profile_status_type AS ENUM (
  'draft',
  'active',
  'inactive',
  'suspended'
);

CREATE TYPE verification_status_type AS ENUM (
  'unverified',
  'pending',
  'verified',
  'rejected'
);

CREATE TYPE scheme_status_type AS ENUM (
  'draft',
  'published',
  'open',
  'closed',
  'active',
  'completed',
  'archived'
);

CREATE TYPE proposal_status_type AS ENUM (
  'draft',
  'submitted',
  'under_review',
  'reviewed',
  'revision',
  'funded',
  'rejected',
  'cancelled',
  'archived'
);

CREATE TYPE member_type AS ENUM (
  'internal_lecturer',
  'external_lecturer',
  'student',
  'staff',
  'other'
);

CREATE TYPE member_role_type AS ENUM (
  'ketua',
  'member',
  'anggota'
);

CREATE TYPE output_kind_type AS ENUM (
  'wajib',
  'tambahan'
);

CREATE TYPE reviewer_assignment_status_type AS ENUM (
  'assigned',
  'in_progress',
  'submitted',
  'completed',
  'revoked'
);

CREATE TYPE review_recommendation_type AS ENUM (
  'approve',
  'revision',
  'reject'
);

CREATE TYPE final_decision_type AS ENUM (
  'funded',
  'revision',
  'rejected'
);

CREATE TYPE contract_status_type AS ENUM (
  'unsigned',
  'signed',
  'revision_required',
  'accepted'
);

CREATE TYPE report_type AS ENUM (
  'interim',
  'final',
  'output'
);

CREATE TYPE report_status_type AS ENUM (
  'not_open',
  'open',
  'draft',
  'submitted',
  'under_review',
  'revision_required',
  'accepted',
  'rejected',
  'overdue'
);

CREATE TYPE funded_review_target_type AS ENUM (
  'monev',
  'report'
);

CREATE TYPE letter_status_type AS ENUM (
  'draft',
  'submitted',
  'form_design',
  'data_required',
  'data_submitted',
  'draft_revision',
  'prechecked',
  'revision_required',
  'approved',
  'rejected',
  'generated'
);

CREATE TYPE external_research_status_type AS ENUM (
  'draft',
  'submitted',
  'under_review',
  'revision_requested',
  'validated',
  'archived'
);

CREATE TYPE notification_priority_type AS ENUM (
  'low',
  'normal',
  'high',
  'critical'
);

CREATE TYPE file_status_type AS ENUM (
  'pending',
  'ready',
  'quarantined',
  'deleted'
);

CREATE TYPE outbox_status_type AS ENUM (
  'queued',
  'processing',
  'sent',
  'failed',
  'cancelled'
);

-- ---------------------------------------------------------------------
-- Shared functions and lookup data
-- ---------------------------------------------------------------------

CREATE FUNCTION set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE roles (
  code role_type PRIMARY KEY,
  name varchar(100) NOT NULL UNIQUE,
  description text
);

CREATE TABLE admin_scopes (
  code admin_scope_type PRIMARY KEY,
  name varchar(120) NOT NULL UNIQUE,
  description text
);

CREATE TABLE sdg_goals (
  id smallint PRIMARY KEY CHECK (id BETWEEN 1 AND 17),
  name varchar(160) NOT NULL UNIQUE
);

CREATE TABLE budget_categories (
  code varchar(40) PRIMARY KEY,
  name varchar(120) NOT NULL UNIQUE,
  position smallint NOT NULL CHECK (position > 0)
);

CREATE TABLE review_criteria (
  code varchar(80) PRIMARY KEY,
  name varchar(180) NOT NULL,
  category varchar(120) NOT NULL,
  weight numeric(5,2) NOT NULL CHECK (weight > 0 AND weight <= 100),
  minimum_score smallint NOT NULL DEFAULT 1 CHECK (minimum_score >= 0),
  maximum_score smallint NOT NULL DEFAULT 100 CHECK (maximum_score > minimum_score),
  position smallint NOT NULL CHECK (position > 0),
  is_active boolean NOT NULL DEFAULT true
);

-- ---------------------------------------------------------------------
-- Accounts, authentication, files, and researcher profiles
-- ---------------------------------------------------------------------

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email varchar(320) NOT NULL,
  password_hash text NOT NULL,
  name varchar(180) NOT NULL,
  role role_type NOT NULL REFERENCES roles(code),
  is_active boolean NOT NULL DEFAULT true,
  applicant_enabled boolean NOT NULL DEFAULT false,
  default_mode varchar(20),
  identifier varchar(80),
  activation_token_hash text,
  activation_expires_at timestamptz,
  last_login_at timestamptz,
  password_changed_at timestamptz,
  deactivation_reason text,
  deactivated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  deactivated_at timestamptz,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT users_default_mode_check
    CHECK (default_mode IS NULL OR default_mode IN ('management', 'lecturer')),
  CONSTRAINT users_manager_mode_check
    CHECK (default_mode IS DISTINCT FROM 'lecturer' OR role IN ('manager', 'lecturer'))
);

CREATE UNIQUE INDEX users_email_unique_idx ON users (lower(email));
CREATE INDEX users_role_active_idx ON users (role, is_active);

CREATE TABLE user_admin_scopes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scope admin_scope_type NOT NULL REFERENCES admin_scopes(code),
  assigned_by uuid REFERENCES users(id) ON DELETE SET NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, scope)
);

CREATE TABLE user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  ip_address inet,
  user_agent text,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (expires_at > created_at)
);

CREATE INDEX user_sessions_user_expiry_idx ON user_sessions (user_id, expires_at DESC);

CREATE TABLE account_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose varchar(40) NOT NULL CHECK (purpose IN ('activation', 'password_reset', 'email_change')),
  token_hash text NOT NULL UNIQUE,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (expires_at > created_at)
);

CREATE TABLE stored_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  storage_provider varchar(40) NOT NULL DEFAULT 'local',
  storage_key text NOT NULL UNIQUE,
  file_url text,
  original_name varchar(255) NOT NULL,
  mime_type varchar(160) NOT NULL,
  extension varchar(20),
  size_bytes bigint NOT NULL CHECK (size_bytes >= 0),
  checksum_sha256 varchar(64),
  status file_status_type NOT NULL DEFAULT 'ready',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX stored_files_owner_idx ON stored_files (owner_user_id, uploaded_at DESC);
CREATE INDEX stored_files_status_idx ON stored_files (status);

CREATE TABLE researcher_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  full_name varchar(180) NOT NULL,
  front_title varchar(80),
  back_title varchar(80),
  nidn varchar(80),
  nik varchar(80),
  nip varchar(80),
  birth_place varchar(120),
  birth_date date,
  gender varchar(40),
  nationality varchar(80) NOT NULL DEFAULT 'Indonesia',
  institution_email varchar(320),
  alternate_email varchar(320),
  phone_number varchar(40),
  domicile_address text,
  correspondence_address text,
  faculty varchar(180),
  study_program varchar(180),
  unit varchar(180),
  position varchar(180),
  functional_position varchar(180),
  education_level varchar(40),
  employment_status varchar(80),
  orcid varchar(40),
  google_scholar text,
  sinta_id varchar(80),
  sinta_score integer NOT NULL DEFAULT 0 CHECK (sinta_score >= 0),
  research_count integer NOT NULL DEFAULT 0 CHECK (research_count >= 0),
  last_research_year smallint,
  bank_name varchar(120),
  bank_account_number varchar(100),
  bank_account_name varchar(180),
  emergency_contact_name varchar(180),
  emergency_contact_relation varchar(80),
  emergency_contact_phone varchar(40),
  profile_photo_file_id uuid REFERENCES stored_files(id) ON DELETE SET NULL,
  profile_status profile_status_type NOT NULL DEFAULT 'draft',
  verification_status verification_status_type NOT NULL DEFAULT 'unverified',
  completeness smallint NOT NULL DEFAULT 0 CHECK (completeness BETWEEN 0 AND 100),
  last_updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX researcher_profiles_nidn_unique_idx
  ON researcher_profiles (nidn) WHERE nidn IS NOT NULL AND nidn <> '';
CREATE INDEX researcher_profiles_status_idx
  ON researcher_profiles (profile_status, verification_status);
CREATE INDEX researcher_profiles_faculty_idx ON researcher_profiles (faculty);

CREATE TABLE researcher_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES researcher_profiles(id) ON DELETE CASCADE,
  document_type varchar(80) NOT NULL,
  file_id uuid NOT NULL REFERENCES stored_files(id) ON DELETE RESTRICT,
  uploaded_by uuid REFERENCES users(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  uploaded_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX researcher_documents_profile_idx
  ON researcher_documents (profile_id, document_type, is_active);

CREATE TABLE researcher_expertise (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(160) NOT NULL UNIQUE
);

CREATE TABLE researcher_expertise_map (
  profile_id uuid NOT NULL REFERENCES researcher_profiles(id) ON DELETE CASCADE,
  expertise_id uuid NOT NULL REFERENCES researcher_expertise(id) ON DELETE CASCADE,
  is_primary boolean NOT NULL DEFAULT false,
  PRIMARY KEY (profile_id, expertise_id)
);

CREATE TABLE researcher_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES researcher_profiles(id) ON DELETE CASCADE,
  status verification_status_type NOT NULL,
  notes text,
  checklist jsonb NOT NULL DEFAULT '{}'::jsonb,
  verified_by uuid REFERENCES users(id) ON DELETE SET NULL,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX researcher_verifications_profile_idx
  ON researcher_verifications (profile_id, created_at DESC);

CREATE TABLE researcher_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES researcher_profiles(id) ON DELETE CASCADE,
  old_status profile_status_type,
  new_status profile_status_type NOT NULL,
  reason text,
  changed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE admin_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES researcher_profiles(id) ON DELETE CASCADE,
  admin_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assigned_by uuid REFERENCES users(id) ON DELETE SET NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  UNIQUE (profile_id, admin_id)
);

CREATE TABLE applicant_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  name varchar(180) NOT NULL,
  identifier varchar(80),
  applicant_role varchar(120),
  applicant_kind varchar(80) NOT NULL,
  status varchar(80),
  faculty varchar(180),
  study_program varchar(180),
  email varchar(320),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE previous_ethics_clearances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  applicant_name varchar(180),
  clearance_number varchar(160) NOT NULL UNIQUE,
  research_title text NOT NULL,
  issued_at date NOT NULL,
  expiry_date date NOT NULL,
  file_id uuid REFERENCES stored_files(id) ON DELETE SET NULL,
  CHECK (expiry_date >= issued_at)
);

-- ---------------------------------------------------------------------
-- Research schemes
-- ---------------------------------------------------------------------

CREATE TABLE schemes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(220) NOT NULL,
  description text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  registration_start_at timestamptz NOT NULL,
  registration_end_at timestamptz NOT NULL,
  year smallint NOT NULL CHECK (year BETWEEN 2000 AND 2200),
  maximum_budget numeric(16,2) NOT NULL CHECK (maximum_budget > 0),
  status scheme_status_type NOT NULL DEFAULT 'draft',
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  published_at timestamptz,
  archived_at timestamptz,
  -- Logical deletion retains proposal references and is forbidden after funding.
  deleted_at timestamptz,
  deleted_by uuid REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_date >= start_date),
  CHECK (registration_end_at >= registration_start_at),
  CHECK (deleted_at IS NULL OR (status = 'archived' AND deleted_by IS NOT NULL))
);

CREATE INDEX schemes_status_registration_idx
  ON schemes (status, registration_start_at, registration_end_at);
CREATE INDEX schemes_year_idx ON schemes (year DESC);

CREATE TABLE scheme_filter_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scheme_id uuid NOT NULL REFERENCES schemes(id) ON DELETE CASCADE,
  field_name varchar(100) NOT NULL,
  operator varchar(30) NOT NULL,
  value jsonb NOT NULL,
  position smallint NOT NULL DEFAULT 1 CHECK (position > 0),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE scheme_eligible_users (
  scheme_id uuid NOT NULL REFERENCES schemes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  eligibility_source varchar(30) NOT NULL DEFAULT 'manual',
  evaluated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (scheme_id, user_id)
);

CREATE INDEX scheme_eligible_users_user_idx ON scheme_eligible_users (user_id, scheme_id);

CREATE TABLE scheme_output_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scheme_id uuid NOT NULL REFERENCES schemes(id) ON DELETE CASCADE,
  name varchar(220) NOT NULL,
  category varchar(80) NOT NULL,
  configuration jsonb NOT NULL DEFAULT '{}'::jsonb,
  position smallint NOT NULL CHECK (position > 0),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (scheme_id, position)
);

CREATE TABLE scheme_attachment_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scheme_id uuid NOT NULL REFERENCES schemes(id) ON DELETE CASCADE,
  category varchar(100) NOT NULL,
  name varchar(220) NOT NULL,
  accepted_extensions varchar(255) NOT NULL,
  template_accepted_extensions varchar(255),
  is_required boolean NOT NULL DEFAULT true,
  is_custom boolean NOT NULL DEFAULT false,
  template_file_id uuid REFERENCES stored_files(id) ON DELETE SET NULL,
  position smallint NOT NULL CHECK (position > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (scheme_id, category)
);

CREATE TABLE scheme_reporting_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scheme_id uuid NOT NULL REFERENCES schemes(id) ON DELETE CASCADE,
  report_type report_type NOT NULL,
  label varchar(180) NOT NULL,
  open_at timestamptz NOT NULL,
  due_at timestamptz NOT NULL,
  position smallint NOT NULL CHECK (position > 0),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (due_at >= open_at),
  UNIQUE (scheme_id, position)
);

CREATE UNIQUE INDEX scheme_one_final_period_idx
  ON scheme_reporting_periods (scheme_id)
  WHERE report_type = 'final';
CREATE INDEX scheme_reporting_period_window_idx
  ON scheme_reporting_periods (scheme_id, open_at, due_at);

CREATE TABLE scheme_registration_extensions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scheme_id uuid NOT NULL REFERENCES schemes(id) ON DELETE CASCADE,
  previous_deadline timestamptz NOT NULL,
  new_deadline timestamptz NOT NULL,
  reason text,
  opened_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (new_deadline > previous_deadline)
);

CREATE TABLE scheme_reporting_period_extensions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id uuid NOT NULL REFERENCES scheme_reporting_periods(id) ON DELETE CASCADE,
  previous_deadline timestamptz NOT NULL,
  new_deadline timestamptz NOT NULL,
  reason text,
  opened_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (new_deadline > previous_deadline)
);

-- ---------------------------------------------------------------------
-- Proposal drafts, reviewer workflow, and final decision
-- ---------------------------------------------------------------------

CREATE TABLE research_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  scheme_id uuid NOT NULL REFERENCES schemes(id) ON DELETE RESTRICT,
  status proposal_status_type NOT NULL DEFAULT 'draft',
  current_step smallint NOT NULL DEFAULT 1 CHECK (current_step BETWEEN 1 AND 6),
  requested_budget numeric(16,2) CHECK (requested_budget IS NULL OR requested_budget >= 0),
  budget_sections jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(budget_sections) = 'array'),
  -- Partial wizard fields live here until submission; child rows may be absent.
  payload jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(payload) = 'object'),
  archive_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  last_saved_at timestamptz,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  decided_at timestamptz,
  archived_at timestamptz,
  archived_by uuid REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX research_drafts_one_open_draft_idx
  ON research_drafts (user_id, scheme_id)
  WHERE status = 'draft';
CREATE INDEX research_drafts_owner_status_idx
  ON research_drafts (user_id, status, updated_at DESC);
CREATE INDEX research_drafts_scheme_status_idx
  ON research_drafts (scheme_id, status, submitted_at DESC);

CREATE TABLE draft_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id uuid NOT NULL UNIQUE REFERENCES research_drafts(id) ON DELETE CASCADE,
  title text NOT NULL,
  abstract text,
  background text,
  objectives text,
  methodology text,
  target_tkt smallint CHECK (target_tkt IS NULL OR target_tkt BETWEEN 1 AND 9),
  rip_relation varchar(180),
  research_center_relation varchar(180),
  research_center_other varchar(180),
  integrated_to_teaching boolean,
  course_name varchar(180),
  academic_year varchar(20),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE draft_project_sdgs (
  project_id uuid NOT NULL REFERENCES draft_projects(id) ON DELETE CASCADE,
  sdg_id smallint NOT NULL REFERENCES sdg_goals(id),
  PRIMARY KEY (project_id, sdg_id)
);

CREATE TABLE draft_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id uuid NOT NULL REFERENCES research_drafts(id) ON DELETE CASCADE,
  role member_role_type NOT NULL,
  member_type member_type NOT NULL,
  profile_id uuid REFERENCES researcher_profiles(id) ON DELETE SET NULL,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  name varchar(180) NOT NULL,
  identifier varchar(80),
  nidn varchar(80),
  nim varchar(80),
  study_program varchar(180),
  faculty varchar(180),
  orcid varchar(40),
  email varchar(320),
  position smallint NOT NULL CHECK (position > 0),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (draft_id, position)
);

CREATE UNIQUE INDEX draft_one_lead_researcher_idx
  ON draft_members (draft_id)
  WHERE role = 'ketua';
CREATE INDEX draft_members_profile_idx ON draft_members (profile_id);

CREATE TABLE draft_budget_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id uuid NOT NULL REFERENCES research_drafts(id) ON DELETE CASCADE,
  category_code varchar(40) REFERENCES budget_categories(code),
  section_key varchar(128),
  section_label varchar(180),
  component varchar(180) NOT NULL,
  item_name varchar(220) NOT NULL,
  volume numeric(12,2) NOT NULL CHECK (volume > 0),
  unit varchar(80) NOT NULL,
  unit_price numeric(16,2) NOT NULL CHECK (unit_price >= 0),
  total_amount numeric(16,2)
    GENERATED ALWAYS AS (round(volume * unit_price, 2)) STORED,
  notes text,
  position smallint NOT NULL CHECK (position > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (draft_id, category_code, position),
  UNIQUE (draft_id, section_key, position),
  CHECK (category_code IS NOT NULL OR (NULLIF(trim(section_key), '') IS NOT NULL AND NULLIF(trim(section_label), '') IS NOT NULL))
);

-- requested_budget is optional legacy data; the current UI uses the uploaded RAB.
-- Itemized sections are optional; never require a manually entered RAB total.
-- budget_sections maps to budgetSections [{key, label}], including sections with no items.
-- Custom budget items use category_code NULL and retain their section_key/section_label.

CREATE INDEX draft_budget_items_draft_idx ON draft_budget_items (draft_id, category_code);

CREATE TABLE draft_outputs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id uuid NOT NULL REFERENCES research_drafts(id) ON DELETE CASCADE,
  scheme_output_option_id uuid REFERENCES scheme_output_options(id) ON DELETE SET NULL,
  output_kind output_kind_type NOT NULL,
  name varchar(220) NOT NULL,
  category varchar(80) NOT NULL,
  description text NOT NULL,
  configuration jsonb NOT NULL DEFAULT '{}'::jsonb,
  position smallint NOT NULL CHECK (position > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (draft_id, position)
);

CREATE INDEX draft_outputs_draft_kind_idx ON draft_outputs (draft_id, output_kind);

CREATE TABLE draft_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id uuid NOT NULL REFERENCES research_drafts(id) ON DELETE CASCADE,
  requirement_id uuid REFERENCES scheme_attachment_requirements(id) ON DELETE SET NULL,
  category varchar(100) NOT NULL,
  file_id uuid NOT NULL REFERENCES stored_files(id) ON DELETE RESTRICT,
  uploaded_by uuid REFERENCES users(id) ON DELETE SET NULL,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (draft_id, category)
);

CREATE TABLE proposal_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id uuid NOT NULL REFERENCES research_drafts(id) ON DELETE CASCADE,
  revision_number integer NOT NULL DEFAULT 1 CHECK (revision_number > 0),
  snapshot jsonb NOT NULL,
  submitted_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (draft_id, revision_number)
);

CREATE TABLE proposal_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id uuid NOT NULL REFERENCES research_drafts(id) ON DELETE CASCADE,
  status verification_status_type NOT NULL,
  checklist jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  verified_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  verified_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX proposal_verifications_draft_idx
  ON proposal_verifications (draft_id, verified_at DESC);

CREATE TABLE reviewer_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id uuid NOT NULL REFERENCES research_drafts(id) ON DELETE CASCADE,
  submission_id uuid REFERENCES proposal_submissions(id) ON DELETE SET NULL,
  reviewer_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  review_round integer NOT NULL DEFAULT 1 CHECK (review_round > 0),
  status reviewer_assignment_status_type NOT NULL DEFAULT 'assigned',
  assigned_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  due_at timestamptz,
  started_at timestamptz,
  submitted_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid REFERENCES users(id) ON DELETE SET NULL,
  revocation_reason text,
  UNIQUE (draft_id, reviewer_id, review_round)
);

CREATE INDEX reviewer_assignments_reviewer_status_idx
  ON reviewer_assignments (reviewer_id, status, due_at);

CREATE TABLE reviewer_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES reviewer_assignments(id) ON DELETE CASCADE,
  sent_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  channel varchar(20) NOT NULL DEFAULT 'both'
    CHECK (channel IN ('in_app', 'email', 'both')),
  message text,
  sent_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX reviewer_reminders_assignment_sent_idx
  ON reviewer_reminders (assignment_id, sent_at DESC);

CREATE VIEW temporary_role_assignments AS
SELECT
  id,
  reviewer_id AS user_id,
  'reviewer'::text AS role,
  'research_proposal'::text AS entity_type,
  draft_id AS entity_id,
  status::text,
  assigned_at,
  assigned_by,
  revoked_at
FROM reviewer_assignments
WHERE status IN ('assigned', 'in_progress', 'submitted');

CREATE TABLE submission_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL UNIQUE REFERENCES reviewer_assignments(id) ON DELETE CASCADE,
  recommendation review_recommendation_type NOT NULL,
  total_score numeric(6,2) NOT NULL CHECK (total_score BETWEEN 0 AND 100),
  strengths text,
  weaknesses text,
  budget_notes text,
  output_notes text,
  revision_notes text,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE review_score_details (
  review_id uuid NOT NULL REFERENCES submission_reviews(id) ON DELETE CASCADE,
  criteria_code varchar(80) NOT NULL REFERENCES review_criteria(code),
  score numeric(6,2) NOT NULL CHECK (score BETWEEN 0 AND 100),
  weighted_score numeric(8,4) NOT NULL CHECK (weighted_score BETWEEN 0 AND 100),
  notes text,
  PRIMARY KEY (review_id, criteria_code)
);

CREATE TABLE proposal_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id uuid NOT NULL REFERENCES research_drafts(id) ON DELETE CASCADE,
  decision_round integer NOT NULL DEFAULT 1 CHECK (decision_round > 0),
  decision final_decision_type NOT NULL,
  is_final boolean GENERATED ALWAYS AS (decision IN ('funded', 'rejected')) STORED,
  notes text,
  decided_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  signer_name varchar(180) NOT NULL,
  signer_role varchar(120) NOT NULL,
  decided_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (draft_id, decision_round)
);

CREATE UNIQUE INDEX proposal_decisions_one_final_idx
  ON proposal_decisions (draft_id)
  WHERE is_final;

CREATE FUNCTION sync_proposal_decision_state()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM submission_reviews review
    JOIN reviewer_assignments assignment ON assignment.id = review.assignment_id
    WHERE assignment.draft_id = NEW.draft_id
  ) THEN
    RAISE EXCEPTION 'Proposal % cannot receive a decision before a reviewer submits a review.', NEW.draft_id;
  END IF;

  UPDATE research_drafts
  SET
    status = NEW.decision::text::proposal_status_type,
    decided_at = CASE WHEN NEW.is_final THEN NEW.decided_at ELSE NULL END,
    updated_at = now()
  WHERE id = NEW.draft_id AND status IS DISTINCT FROM NEW.decision::text::proposal_status_type;

  IF NEW.is_final THEN
    UPDATE reviewer_assignments
    SET
      status = 'revoked',
      revoked_at = COALESCE(revoked_at, NEW.decided_at),
      revoked_by = COALESCE(revoked_by, NEW.decided_by),
      revocation_reason = COALESCE(revocation_reason, 'Final proposal decision recorded')
    WHERE draft_id = NEW.draft_id
      AND status <> 'revoked';
  ELSE
    UPDATE reviewer_assignments
    SET status = 'completed'
    WHERE draft_id = NEW.draft_id
      AND status IN ('assigned', 'in_progress', 'submitted');
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER proposal_decisions_sync_state
AFTER INSERT ON proposal_decisions
FOR EACH ROW EXECUTE FUNCTION sync_proposal_decision_state();

CREATE TABLE funding_letters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id uuid NOT NULL UNIQUE REFERENCES research_drafts(id) ON DELETE CASCADE,
  letter_number varchar(180) NOT NULL UNIQUE,
  file_id uuid REFERENCES stored_files(id) ON DELETE SET NULL,
  file_name varchar(255),
  signed_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  signer_name varchar(180) NOT NULL,
  signer_role varchar(120) NOT NULL,
  issued_at timestamptz NOT NULL,
  signed_at timestamptz NOT NULL
);

-- ---------------------------------------------------------------------
-- Funded research, contracts, Monev, reports, outputs, and logbooks
-- The funded research id intentionally equals its proposal id. This keeps
-- /research/:researchId compatible with the current frontend aggregate.
-- ---------------------------------------------------------------------

CREATE TABLE funded_research (
  id uuid PRIMARY KEY REFERENCES research_drafts(id) ON DELETE RESTRICT,
  scheme_id uuid NOT NULL REFERENCES schemes(id) ON DELETE RESTRICT,
  lead_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  title text NOT NULL,
  status varchar(40) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'completed', 'suspended', 'archived')),
  funded_amount numeric(16,2) NOT NULL CHECK (funded_amount >= 0),
  started_at date,
  ended_at date,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ended_at IS NULL OR started_at IS NULL OR ended_at >= started_at)
);

CREATE INDEX funded_research_lead_status_idx
  ON funded_research (lead_user_id, status, updated_at DESC);

CREATE TABLE research_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  research_id uuid NOT NULL UNIQUE REFERENCES funded_research(id) ON DELETE CASCADE,
  status contract_status_type NOT NULL DEFAULT 'unsigned',
  template_file_id uuid REFERENCES stored_files(id) ON DELETE SET NULL,
  signed_file_id uuid REFERENCES stored_files(id) ON DELETE SET NULL,
  template_name varchar(255),
  signed_by_user_at timestamptz,
  accepted_by uuid REFERENCES users(id) ON DELETE SET NULL,
  accepted_at timestamptz,
  revision_notes text,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE research_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  research_id uuid NOT NULL REFERENCES funded_research(id) ON DELETE CASCADE,
  period_id uuid NOT NULL REFERENCES scheme_reporting_periods(id) ON DELETE RESTRICT,
  output_id uuid REFERENCES draft_outputs(id) ON DELETE SET NULL,
  report_type report_type NOT NULL,
  report_period varchar(180) NOT NULL,
  status report_status_type NOT NULL DEFAULT 'draft',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  submitted_by uuid REFERENCES users(id) ON DELETE SET NULL,
  submitted_at timestamptz,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (research_id, period_id, output_id)
);

CREATE UNIQUE INDEX research_reports_without_output_unique_idx
  ON research_reports (research_id, period_id)
  WHERE output_id IS NULL;
CREATE INDEX research_reports_status_idx
  ON research_reports (status, submitted_at DESC);

CREATE TABLE research_report_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES research_reports(id) ON DELETE CASCADE,
  file_id uuid NOT NULL REFERENCES stored_files(id) ON DELETE RESTRICT,
  category varchar(100) NOT NULL DEFAULT 'report',
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (report_id, file_id)
);

CREATE TABLE report_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES research_reports(id) ON DELETE CASCADE,
  decision report_status_type NOT NULL
    CHECK (decision IN ('revision_required', 'accepted', 'rejected')),
  notes text,
  reviewer_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  reviewed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE research_monev (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  research_id uuid NOT NULL REFERENCES funded_research(id) ON DELETE CASCADE,
  period_id uuid NOT NULL REFERENCES scheme_reporting_periods(id) ON DELETE RESTRICT,
  period_label varchar(180) NOT NULL,
  status report_status_type NOT NULL DEFAULT 'draft',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  evaluated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  published_at timestamptz,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (research_id, period_id)
);

CREATE TABLE research_monev_files (
  monev_id uuid NOT NULL REFERENCES research_monev(id) ON DELETE CASCADE,
  file_id uuid NOT NULL REFERENCES stored_files(id) ON DELETE RESTRICT,
  category varchar(100) NOT NULL DEFAULT 'evidence',
  PRIMARY KEY (monev_id, file_id)
);

-- A funded research review is deliberately separate from report_reviews.
-- Reviewer scoring is advisory; report_reviews remains the management decision.
CREATE TABLE funded_review_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  research_id uuid NOT NULL REFERENCES funded_research(id) ON DELETE CASCADE,
  target_type funded_review_target_type NOT NULL,
  monev_id uuid REFERENCES research_monev(id) ON DELETE CASCADE,
  report_id uuid REFERENCES research_reports(id) ON DELETE CASCADE,
  reviewer_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  review_round integer NOT NULL DEFAULT 1 CHECK (review_round > 0),
  status reviewer_assignment_status_type NOT NULL DEFAULT 'assigned',
  assigned_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  due_at timestamptz,
  started_at timestamptz,
  submitted_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid REFERENCES users(id) ON DELETE SET NULL,
  revocation_reason text,
  CHECK (
    (target_type = 'monev' AND monev_id IS NOT NULL AND report_id IS NULL)
    OR
    (target_type = 'report' AND report_id IS NOT NULL AND monev_id IS NULL)
  )
);

CREATE UNIQUE INDEX funded_review_assignments_monev_reviewer_round_idx
  ON funded_review_assignments (monev_id, reviewer_id, review_round)
  WHERE monev_id IS NOT NULL;
CREATE UNIQUE INDEX funded_review_assignments_report_reviewer_round_idx
  ON funded_review_assignments (report_id, reviewer_id, review_round)
  WHERE report_id IS NOT NULL;
CREATE INDEX funded_review_assignments_reviewer_status_idx
  ON funded_review_assignments (reviewer_id, status, due_at);
CREATE INDEX funded_review_assignments_research_target_idx
  ON funded_review_assignments (research_id, target_type, assigned_at DESC);

CREATE TABLE funded_reviewer_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES funded_review_assignments(id) ON DELETE CASCADE,
  sent_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  channel varchar(20) NOT NULL DEFAULT 'both'
    CHECK (channel IN ('in_app', 'email', 'both')),
  message text,
  sent_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX funded_reviewer_reminders_assignment_sent_idx
  ON funded_reviewer_reminders (assignment_id, sent_at DESC);

CREATE TABLE funded_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL UNIQUE REFERENCES funded_review_assignments(id) ON DELETE CASCADE,
  recommendation review_recommendation_type NOT NULL,
  total_score numeric(6,2) NOT NULL CHECK (total_score BETWEEN 0 AND 100),
  substance_notes text NOT NULL,
  technical_notes text NOT NULL,
  follow_up_notes text NOT NULL,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE funded_review_score_details (
  review_id uuid NOT NULL REFERENCES funded_reviews(id) ON DELETE CASCADE,
  criteria_code varchar(80) NOT NULL,
  criteria_label varchar(255) NOT NULL,
  criteria_group varchar(180) NOT NULL,
  weight numeric(6,2) NOT NULL CHECK (weight > 0 AND weight <= 100),
  score numeric(6,2) NOT NULL CHECK (score BETWEEN 0 AND 100),
  weighted_score numeric(8,4) NOT NULL CHECK (weighted_score BETWEEN 0 AND 100),
  notes text,
  PRIMARY KEY (review_id, criteria_code)
);

CREATE OR REPLACE VIEW temporary_role_assignments AS
SELECT
  id,
  reviewer_id AS user_id,
  'reviewer'::text AS role,
  'research_proposal'::text AS entity_type,
  draft_id AS entity_id,
  status::text,
  assigned_at,
  assigned_by,
  revoked_at
FROM reviewer_assignments
WHERE status IN ('assigned', 'in_progress', 'submitted')
UNION ALL
SELECT
  id,
  reviewer_id AS user_id,
  'reviewer'::text AS role,
  ('funded_' || target_type::text) AS entity_type,
  COALESCE(monev_id, report_id) AS entity_id,
  status::text,
  assigned_at,
  assigned_by,
  revoked_at
FROM funded_review_assignments
WHERE status IN ('assigned', 'in_progress', 'submitted');

CREATE TABLE research_logbooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  research_id uuid NOT NULL REFERENCES funded_research(id) ON DELETE CASCADE,
  activity_date date NOT NULL,
  start_time time,
  end_time time,
  description text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_time IS NULL OR start_time IS NULL OR end_time >= start_time)
);

CREATE INDEX research_logbooks_research_date_idx
  ON research_logbooks (research_id, activity_date DESC);

CREATE TABLE logbook_files (
  logbook_id uuid NOT NULL REFERENCES research_logbooks(id) ON DELETE CASCADE,
  file_id uuid NOT NULL REFERENCES stored_files(id) ON DELETE RESTRICT,
  PRIMARY KEY (logbook_id, file_id)
);

-- ---------------------------------------------------------------------
-- Letter requests
-- ---------------------------------------------------------------------

-- Reusable catalog published before lecturers submit an application.
-- Existing request templates/fields remain immutable per-application copies.
CREATE TABLE letter_master_templates (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  name varchar(240) NOT NULL DEFAULT 'Master Template Surat',
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  template_content text NOT NULL,
  fields jsonb NOT NULL CHECK (jsonb_typeof(fields) = 'array'),
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE letter_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(240) NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  letter_type varchar(80) NOT NULL,
  purpose varchar(120),
  is_active boolean NOT NULL DEFAULT false,
  lifecycle_status varchar(20) NOT NULL DEFAULT 'draft' CHECK (lifecycle_status IN ('draft', 'published', 'inactive', 'deleted')),
  master_version integer CHECK (master_version > 0),
  pending_draft jsonb CHECK (pending_draft IS NULL OR jsonb_typeof(pending_draft) = 'object'),
  deleted_at timestamptz,
  deleted_by uuid REFERENCES users(id) ON DELETE SET NULL,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  template_name varchar(240) NOT NULL DEFAULT '',
  template_content text NOT NULL DEFAULT '',
  fields jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(fields) = 'array'),
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (is_active = (lifecycle_status = 'published')),
  CHECK ((lifecycle_status = 'deleted') = (deleted_at IS NOT NULL)),
  CHECK (NOT is_active OR (length(btrim(name)) > 0 AND length(btrim(template_content)) > 0 AND jsonb_array_length(fields) > 0))
);
CREATE INDEX letter_definitions_active_idx ON letter_definitions (is_active, name);

CREATE TABLE letter_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  research_id uuid REFERENCES funded_research(id) ON DELETE SET NULL,
  definition_id uuid REFERENCES letter_definitions(id) ON DELETE SET NULL,
  definition_version integer CHECK (definition_version > 0),
  definition_name varchar(240),
  letter_type varchar(80) NOT NULL,
  purpose varchar(120),
  custom_name varchar(240),
  status letter_status_type NOT NULL DEFAULT 'draft',
  auto_fill_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  form_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  letter_number varchar(180),
  generated_file_id uuid REFERENCES stored_files(id) ON DELETE SET NULL,
  generated_file_url text,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  submitted_at timestamptz,
  accepted_at timestamptz,
  accepted_by uuid REFERENCES users(id) ON DELETE SET NULL,
  configured_at timestamptz,
  configured_by uuid REFERENCES users(id) ON DELETE SET NULL,
  data_submitted_at timestamptz,
  generated_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX letter_requests_number_unique_idx
  ON letter_requests (letter_number)
  WHERE letter_number IS NOT NULL;
CREATE INDEX letter_requests_owner_status_idx
  ON letter_requests (user_id, status, updated_at DESC);
CREATE INDEX letter_requests_status_idx
  ON letter_requests (status, submitted_at DESC);
CREATE INDEX letter_requests_research_idx
  ON letter_requests (research_id, created_at DESC);

ALTER TABLE letter_requests ADD CONSTRAINT letter_request_kind_check CHECK (
  (letter_type = 'custom' AND nullif(btrim(custom_name), '') IS NOT NULL AND purpose IS NULL)
  OR
  (letter_type <> 'custom' AND nullif(btrim(purpose), '') IS NOT NULL)
);

CREATE TABLE letter_applicants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  letter_id uuid NOT NULL REFERENCES letter_requests(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  name varchar(180) NOT NULL,
  identifier varchar(80),
  applicant_role varchar(120),
  applicant_kind varchar(80),
  status varchar(80),
  faculty varchar(180),
  study_program varchar(180),
  email varchar(320),
  is_primary boolean NOT NULL DEFAULT false,
  position smallint NOT NULL CHECK (position > 0),
  UNIQUE (letter_id, position)
);

CREATE UNIQUE INDEX letter_one_primary_applicant_idx
  ON letter_applicants (letter_id)
  WHERE is_primary;

CREATE TABLE letter_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  letter_id uuid NOT NULL REFERENCES letter_requests(id) ON DELETE CASCADE,
  file_type varchar(100) NOT NULL,
  category varchar(100) NOT NULL,
  file_id uuid NOT NULL REFERENCES stored_files(id) ON DELETE RESTRICT,
  uploaded_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE letter_request_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  letter_id uuid NOT NULL UNIQUE REFERENCES letter_requests(id) ON DELETE CASCADE,
  template_name varchar(240) NOT NULL,
  content_template text NOT NULL,
  template_format varchar(20) NOT NULL DEFAULT 'txt'
    CHECK (template_format IN ('txt', 'html', 'docx', 'latex')),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  configured_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  configured_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, letter_id)
);

CREATE TABLE letter_request_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES letter_request_templates(id) ON DELETE CASCADE,
  field_key varchar(120) NOT NULL,
  field_label varchar(240) NOT NULL,
  field_type varchar(30) NOT NULL
    CHECK (field_type IN ('text', 'textarea', 'number', 'date', 'datetime-local', 'email', 'select')),
  is_required boolean NOT NULL DEFAULT false,
  placeholder varchar(300),
  help_text text,
  options jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(options) = 'array'),
  position smallint NOT NULL CHECK (position > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, template_id),
  UNIQUE (template_id, field_key),
  UNIQUE (template_id, position)
);

CREATE TABLE letter_request_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  letter_id uuid NOT NULL REFERENCES letter_requests(id) ON DELETE CASCADE,
  template_id uuid NOT NULL,
  field_id uuid NOT NULL,
  field_value jsonb NOT NULL DEFAULT 'null'::jsonb,
  submitted_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (template_id, letter_id) REFERENCES letter_request_templates(id, letter_id) ON DELETE CASCADE,
  FOREIGN KEY (field_id, template_id) REFERENCES letter_request_fields(id, template_id) ON DELETE CASCADE,
  UNIQUE (letter_id, field_id)
);

CREATE INDEX letter_request_values_letter_idx
  ON letter_request_values (letter_id, submitted_at DESC);

CREATE TABLE letter_prechecks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  letter_id uuid NOT NULL REFERENCES letter_requests(id) ON DELETE CASCADE,
  status varchar(30) NOT NULL CHECK (status IN ('passed', 'failed')),
  errors jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text,
  checked_by uuid REFERENCES users(id) ON DELETE SET NULL,
  checked_by_system boolean NOT NULL DEFAULT false,
  checked_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE letter_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  letter_id uuid NOT NULL REFERENCES letter_requests(id) ON DELETE CASCADE,
  reviewer_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  decision varchar(40) NOT NULL
    CHECK (decision IN ('accepted', 'revision_required', 'approved', 'rejected', 'generated')),
  notes text,
  checklist jsonb NOT NULL DEFAULT '{}'::jsonb,
  reviewed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE generated_letters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  letter_id uuid NOT NULL UNIQUE REFERENCES letter_requests(id) ON DELETE CASCADE,
  letter_number varchar(180) NOT NULL UNIQUE,
  file_id uuid REFERENCES stored_files(id) ON DELETE SET NULL,
  file_name varchar(255) NOT NULL,
  file_url text,
  content_snapshot text,
  generated_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  generated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE letter_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  letter_id uuid NOT NULL REFERENCES letter_requests(id) ON DELETE CASCADE,
  old_status letter_status_type,
  new_status letter_status_type NOT NULL,
  note text,
  changed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  changed_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- External research reports
-- ---------------------------------------------------------------------

CREATE TABLE external_research (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  activity_name varchar(240) NOT NULL,
  research_title text NOT NULL,
  activity_year smallint NOT NULL CHECK (activity_year BETWEEN 2000 AND 2200),
  activity_status varchar(40) NOT NULL
    CHECK (activity_status IN ('planned', 'ongoing', 'completed')),
  activity_type varchar(40) NOT NULL,
  role_in_research varchar(40) NOT NULL,
  organizer_origin varchar(220),
  funding_source varchar(220),
  funding_amount numeric(16,2) NOT NULL DEFAULT 0 CHECK (funding_amount >= 0),
  currency char(3) NOT NULL DEFAULT 'IDR',
  submission_status external_research_status_type NOT NULL DEFAULT 'draft',
  category varchar(80) NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  archive_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  type_detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  review_notes text,
  reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  submitted_at timestamptz,
  validated_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX external_research_owner_status_idx
  ON external_research (user_id, submission_status, updated_at DESC);
CREATE INDEX external_research_status_idx
  ON external_research (submission_status, submitted_at DESC);

CREATE TABLE external_research_sdgs (
  external_research_id uuid NOT NULL REFERENCES external_research(id) ON DELETE CASCADE,
  sdg_id smallint NOT NULL REFERENCES sdg_goals(id),
  PRIMARY KEY (external_research_id, sdg_id)
);

CREATE TABLE external_research_outputs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_research_id uuid NOT NULL REFERENCES external_research(id) ON DELETE CASCADE,
  output_type varchar(80) NOT NULL,
  title varchar(240) NOT NULL,
  year smallint CHECK (year BETWEEN 2000 AND 2200),
  description text,
  link text,
  file_id uuid REFERENCES stored_files(id) ON DELETE SET NULL,
  position smallint NOT NULL CHECK (position > 0),
  UNIQUE (external_research_id, position)
);

CREATE TABLE external_research_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_research_id uuid NOT NULL REFERENCES external_research(id) ON DELETE CASCADE,
  file_type varchar(100) NOT NULL,
  file_id uuid NOT NULL REFERENCES stored_files(id) ON DELETE RESTRICT,
  uploaded_by uuid REFERENCES users(id) ON DELETE SET NULL,
  uploaded_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE external_research_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_research_id uuid NOT NULL REFERENCES external_research(id) ON DELETE CASCADE,
  reviewer_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  decision external_research_status_type NOT NULL
    CHECK (decision IN ('revision_requested', 'validated')),
  notes text,
  checklist jsonb NOT NULL DEFAULT '{}'::jsonb,
  reviewed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE external_research_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_research_id uuid NOT NULL REFERENCES external_research(id) ON DELETE CASCADE,
  old_status external_research_status_type,
  new_status external_research_status_type NOT NULL,
  note text,
  changed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  changed_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- Notifications, email queue, idempotency, and audit trail
-- ---------------------------------------------------------------------

CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  from_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  notification_type varchar(100) NOT NULL,
  priority notification_priority_type NOT NULL DEFAULT 'normal',
  title varchar(220) NOT NULL,
  message text NOT NULL,
  entity_type varchar(100),
  entity_id uuid,
  research_id uuid REFERENCES funded_research(id) ON DELETE CASCADE,
  action_path text,
  action_label varchar(100),
  manager_mode varchar(20),
  is_read boolean NOT NULL DEFAULT false,
  read_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT notifications_manager_mode_check
    CHECK (manager_mode IS NULL OR manager_mode IN ('management', 'lecturer')),
  CONSTRAINT notifications_read_state_check
    CHECK ((is_read = false AND read_at IS NULL) OR is_read = true)
);

CREATE INDEX notifications_user_unread_idx
  ON notifications (user_id, is_read, created_at DESC);
CREATE INDEX notifications_entity_idx
  ON notifications (entity_type, entity_id);

CREATE TABLE email_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  recipient_email varchar(320) NOT NULL,
  subject varchar(240) NOT NULL,
  body_text text,
  body_html text,
  template_key varchar(100),
  notification_type varchar(100) NOT NULL,
  entity_type varchar(100),
  entity_id uuid,
  action_path text,
  priority notification_priority_type NOT NULL DEFAULT 'normal',
  delivery_mode varchar(20) NOT NULL DEFAULT 'immediate',
  deduplication_key varchar(500) NOT NULL UNIQUE,
  source_event_id varchar(255),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status outbox_status_type NOT NULL DEFAULT 'queued',
  attempts smallint NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  available_at timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz,
  sent_at timestamptz,
  error_message text,
  provider varchar(40),
  provider_message_id varchar(500),
  last_attempt_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT email_outbox_delivery_mode_check
    CHECK (delivery_mode IN ('immediate', 'digest'))
);

CREATE INDEX email_outbox_delivery_idx
  ON email_outbox (status, available_at, created_at)
  WHERE status IN ('queued', 'failed');
CREATE INDEX email_outbox_recipient_idx
  ON email_outbox (recipient_user_id, created_at DESC);
CREATE INDEX email_outbox_digest_idx
  ON email_outbox (delivery_mode, available_at)
  WHERE status = 'queued';

CREATE TABLE idempotency_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  operation varchar(100) NOT NULL,
  idempotency_key varchar(180) NOT NULL,
  request_hash varchar(64) NOT NULL,
  response_status smallint,
  response_body jsonb,
  locked_at timestamptz,
  completed_at timestamptz,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, operation, idempotency_key)
);

CREATE TABLE system_activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id varchar(180),
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  action varchar(120) NOT NULL,
  entity_type varchar(100) NOT NULL,
  entity_id uuid,
  old_data jsonb,
  new_data jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX system_activity_logs_entity_idx
  ON system_activity_logs (entity_type, entity_id, created_at DESC);
CREATE INDEX system_activity_logs_user_idx
  ON system_activity_logs (user_id, created_at DESC);
CREATE INDEX system_activity_logs_request_idx
  ON system_activity_logs (request_id)
  WHERE request_id IS NOT NULL;

-- Cross-record integrity. Final-period validation is deferred so a schedule
-- can be replaced atomically within one transaction.
CREATE FUNCTION check_final_reporting_period()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE target_id uuid; target_ids uuid[];
BEGIN
  IF TG_TABLE_NAME = 'schemes' THEN target_ids := ARRAY[NEW.id];
  ELSIF TG_OP = 'INSERT' THEN target_ids := ARRAY[NEW.scheme_id];
  ELSIF TG_OP = 'DELETE' THEN target_ids := ARRAY[OLD.scheme_id];
  ELSE target_ids := ARRAY[OLD.scheme_id, NEW.scheme_id]; END IF;
  FOR target_id IN SELECT DISTINCT value FROM unnest(target_ids) value LOOP
    IF EXISTS (SELECT 1 FROM schemes WHERE id = target_id AND status <> 'draft' AND deleted_at IS NULL)
       AND (SELECT count(*) FROM scheme_reporting_periods WHERE scheme_id = target_id AND report_type = 'final') <> 1 THEN
      RAISE EXCEPTION 'Published scheme % requires exactly one final reporting period.', target_id;
    END IF;
  END LOOP;
  RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER schemes_final_period
AFTER INSERT OR UPDATE ON schemes DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION check_final_reporting_period();
CREATE CONSTRAINT TRIGGER periods_final_period
AFTER INSERT OR UPDATE OR DELETE ON scheme_reporting_periods DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION check_final_reporting_period();

CREATE FUNCTION lock_reporting_scheme()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP <> 'INSERT' THEN
    PERFORM 1 FROM schemes WHERE id = OLD.scheme_id FOR UPDATE;
  END IF;
  IF TG_OP <> 'DELETE' THEN
    PERFORM 1 FROM schemes WHERE id = NEW.scheme_id FOR UPDATE;
    IF TG_OP = 'UPDATE' AND (NEW.scheme_id, NEW.report_type) IS DISTINCT FROM (OLD.scheme_id, OLD.report_type)
       AND (EXISTS (SELECT 1 FROM research_reports WHERE period_id = OLD.id)
            OR EXISTS (SELECT 1 FROM research_monev WHERE period_id = OLD.id)) THEN
      RAISE EXCEPTION 'A reporting period with submissions cannot change scheme or type.';
    END IF;
    RETURN NEW;
  END IF;
  RETURN OLD;
END;
$$;
CREATE TRIGGER periods_lock_scheme BEFORE INSERT OR UPDATE OR DELETE ON scheme_reporting_periods
FOR EACH ROW EXECUTE FUNCTION lock_reporting_scheme();

ALTER TABLE research_drafts ADD UNIQUE (id, scheme_id, user_id);
ALTER TABLE funded_research ADD CONSTRAINT funded_proposal_identity
  FOREIGN KEY (id, scheme_id, lead_user_id) REFERENCES research_drafts(id, scheme_id, user_id);

CREATE FUNCTION check_report_relationships()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE scheme uuid; period scheme_reporting_periods%ROWTYPE;
BEGIN
  SELECT scheme_id INTO scheme FROM funded_research WHERE id = NEW.research_id;
  SELECT * INTO period FROM scheme_reporting_periods WHERE id = NEW.period_id FOR SHARE;
  IF scheme IS NULL OR period.id IS NULL OR period.scheme_id <> scheme THEN
    RAISE EXCEPTION 'Reporting period must belong to the funded research scheme.';
  END IF;
  IF TG_TABLE_NAME = 'research_monev' THEN
    IF period.report_type <> 'interim' THEN RAISE EXCEPTION 'Monev requires an interim period.'; END IF;
  ELSE
    IF NEW.report_type <> period.report_type THEN RAISE EXCEPTION 'Report type does not match period.'; END IF;
    IF (NEW.report_type = 'output') <> (NEW.output_id IS NOT NULL) THEN
      RAISE EXCEPTION 'Only output reports require an output reference.';
    END IF;
    IF NEW.output_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM draft_outputs WHERE id = NEW.output_id AND draft_id = NEW.research_id
    ) THEN RAISE EXCEPTION 'Reported output must belong to the same research.'; END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER reports_check_relationships BEFORE INSERT OR UPDATE ON research_reports
FOR EACH ROW EXECUTE FUNCTION check_report_relationships();
CREATE TRIGGER monev_check_relationships BEFORE INSERT OR UPDATE ON research_monev
FOR EACH ROW EXECUTE FUNCTION check_report_relationships();
ALTER TABLE research_reports ADD UNIQUE (id, research_id);
ALTER TABLE research_monev ADD UNIQUE (id, research_id);
ALTER TABLE funded_review_assignments ADD CONSTRAINT funded_review_report_owner
  FOREIGN KEY (report_id, research_id) REFERENCES research_reports(id, research_id);
ALTER TABLE funded_review_assignments ADD CONSTRAINT funded_review_monev_owner
  FOREIGN KEY (monev_id, research_id) REFERENCES research_monev(id, research_id);

CREATE FUNCTION guard_proposal_scheme()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE deleted timestamptz;
BEGIN
  SELECT deleted_at INTO deleted FROM schemes WHERE id = NEW.scheme_id FOR UPDATE;
  IF deleted IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.status <> 'archived' OR NEW.archived_at IS NULL) THEN
    RAISE EXCEPTION 'Deleted schemes cannot accept or reactivate proposals.';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.archived_at IS NOT NULL AND
     (NEW.status <> 'archived' OR NEW.archived_at IS NULL) THEN
    RAISE EXCEPTION 'Archived proposals cannot be reactivated.';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER drafts_guard_scheme BEFORE INSERT OR UPDATE ON research_drafts
FOR EACH ROW EXECUTE FUNCTION guard_proposal_scheme();

CREATE FUNCTION guard_funded_proposal()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE proposal_id uuid; scheme uuid;
BEGIN
  IF TG_TABLE_NAME = 'funded_research' THEN proposal_id := NEW.id;
  ELSE proposal_id := NEW.draft_id; END IF;
  SELECT scheme_id INTO scheme FROM research_drafts WHERE id = proposal_id;
  PERFORM 1 FROM schemes WHERE id = scheme AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND OR NOT EXISTS (SELECT 1 FROM research_drafts WHERE id = proposal_id AND status = 'funded' AND archived_at IS NULL) THEN
    RAISE EXCEPTION 'Funding records require a funded proposal in a non-deleted scheme.';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER funded_research_guard_proposal BEFORE INSERT OR UPDATE ON funded_research
FOR EACH ROW EXECUTE FUNCTION guard_funded_proposal();
CREATE TRIGGER funding_letters_guard_proposal BEFORE INSERT OR UPDATE ON funding_letters
FOR EACH ROW EXECUTE FUNCTION guard_funded_proposal();

CREATE FUNCTION guard_scheme_deletion()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL THEN
    RAISE EXCEPTION 'Deleted schemes cannot be reactivated.';
  END IF;
  IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL AND (
    EXISTS (SELECT 1 FROM research_drafts WHERE scheme_id = OLD.id AND status = 'funded')
    OR EXISTS (SELECT 1 FROM funded_research WHERE scheme_id = OLD.id)
    OR EXISTS (SELECT 1 FROM proposal_decisions p JOIN research_drafts d ON d.id = p.draft_id WHERE d.scheme_id = OLD.id AND p.decision = 'funded')
    OR EXISTS (SELECT 1 FROM funding_letters f JOIN research_drafts d ON d.id = f.draft_id WHERE d.scheme_id = OLD.id)
  ) THEN RAISE EXCEPTION 'Schemes with funded research cannot be deleted.'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER schemes_guard_deletion BEFORE UPDATE ON schemes
FOR EACH ROW EXECUTE FUNCTION guard_scheme_deletion();

-- Invoke from the authenticated API with the authenticated actor id.
-- This is not SECURITY DEFINER and is not an authentication replacement.
CREATE FUNCTION delete_research_scheme(target_id uuid, actor_id uuid)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE original schemes%ROWTYPE; changed_at timestamptz := now();
BEGIN
  IF NOT EXISTS (SELECT 1 FROM users u WHERE u.id = actor_id AND u.is_active AND
    (u.role IN ('super_admin', 'manager') OR (u.role = 'admin' AND EXISTS (
      SELECT 1 FROM user_admin_scopes a WHERE a.user_id = u.id AND a.scope = 'research_management'
    )))) THEN RAISE EXCEPTION 'Research management permission required.'; END IF;
  SELECT * INTO original FROM schemes WHERE id = target_id FOR UPDATE;
  IF NOT FOUND OR original.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'Scheme not found or already deleted.'; END IF;
  UPDATE schemes SET status = 'archived', deleted_at = changed_at, archived_at = changed_at, deleted_by = actor_id WHERE id = target_id;
  UPDATE research_drafts SET
    archive_metadata = archive_metadata || jsonb_build_object('reason', 'scheme_deleted', 'previousStatus', status, 'schemeId', scheme_id),
    status = 'archived', archived_at = changed_at, archived_by = actor_id
  WHERE scheme_id = target_id AND archived_at IS NULL;
  UPDATE reviewer_assignments SET status = 'revoked', revoked_at = COALESCE(revoked_at, changed_at),
    revoked_by = COALESCE(revoked_by, actor_id), revocation_reason = 'Scheme deleted'
  WHERE draft_id IN (SELECT id FROM research_drafts WHERE scheme_id = target_id);
  DELETE FROM notifications WHERE (entity_type = 'scheme' AND entity_id = target_id)
    OR entity_id IN (SELECT id FROM research_drafts WHERE scheme_id = target_id);
  UPDATE email_outbox SET status = 'cancelled', locked_at = NULL
  WHERE status IN ('queued', 'failed') AND ((entity_type = 'scheme' AND entity_id = target_id)
    OR entity_id IN (SELECT id FROM research_drafts WHERE scheme_id = target_id));
  INSERT INTO system_activity_logs(user_id, action, entity_type, entity_id, old_data, new_data)
    SELECT actor_id, 'delete_research_scheme', 'scheme', target_id, to_jsonb(original), to_jsonb(s) FROM schemes s WHERE id = target_id;
END;
$$;

-- Views used by the archive UI. Include drafts even before project details exist.
CREATE VIEW research_archive_view AS
SELECT
  'internal'::text AS source,
  d.id,
  COALESCE(NULLIF(p.title, ''), NULLIF(d.payload #>> '{project,title}', ''), 'Tanpa judul') AS title,
  d.status::text AS status,
  d.user_id AS owner_user_id,
  s.year,
  s.name AS context,
  COALESCE(p.metadata, '{}'::jsonb) AS metadata,
  d.archive_metadata,
  d.archived_at,
  GREATEST(
    d.updated_at,
    (SELECT max(m.updated_at) FROM research_monev m WHERE m.research_id = d.id),
    (SELECT max(r.updated_at) FROM research_reports r WHERE r.research_id = d.id),
    (SELECT max(l.updated_at) FROM research_logbooks l WHERE l.research_id = d.id),
    (SELECT max(a.assigned_at) FROM funded_review_assignments a WHERE a.research_id = d.id),
    (SELECT max(v.submitted_at) FROM funded_reviews v JOIN funded_review_assignments a ON a.id = v.assignment_id WHERE a.research_id = d.id)
  ) AS updated_at,
  (SELECT count(*) FROM draft_members m WHERE m.draft_id = d.id) AS members_count,
  (SELECT count(*) FROM draft_outputs o WHERE o.draft_id = d.id) AS outputs_count,
  (SELECT count(*) FROM draft_files f WHERE f.draft_id = d.id) AS attachments_count,
  (SELECT count(*) FROM reviewer_assignments a WHERE a.draft_id = d.id) AS reviewer_assignment_count,
  (SELECT count(*) FROM submission_reviews v JOIN reviewer_assignments a ON a.id = v.assignment_id WHERE a.draft_id = d.id) AS review_count,
  COALESCE((SELECT c.status::text FROM research_contracts c WHERE c.research_id = d.id), 'unavailable') AS contract_status,
  (SELECT count(*) FROM research_monev m WHERE m.research_id = d.id) AS monev_count,
  (SELECT count(*) FROM research_reports r WHERE r.research_id = d.id) AS report_count,
  (SELECT count(*) FROM funded_review_assignments a WHERE a.research_id = d.id) AS funded_reviewer_assignment_count,
  (SELECT count(*) FROM funded_reviews v JOIN funded_review_assignments a ON a.id = v.assignment_id WHERE a.research_id = d.id) AS funded_review_count,
  (SELECT count(*) FROM research_logbooks l WHERE l.research_id = d.id) AS logbook_count
FROM research_drafts d
LEFT JOIN draft_projects p ON p.draft_id = d.id
JOIN schemes s ON s.id = d.scheme_id
UNION ALL
SELECT
  'external'::text AS source,
  er.id,
  er.research_title AS title,
  er.submission_status::text AS status,
  er.user_id AS owner_user_id,
  er.activity_year AS year,
  COALESCE(er.category, er.activity_type) AS context,
  er.metadata,
  er.archive_metadata,
  er.archived_at,
  GREATEST(er.updated_at, (SELECT max(h.changed_at) FROM external_research_history h WHERE h.external_research_id = er.id)) AS updated_at,
  0::bigint AS members_count,
  (SELECT count(*) FROM external_research_outputs o WHERE o.external_research_id = er.id) AS outputs_count,
  (SELECT count(*) FROM external_research_files f WHERE f.external_research_id = er.id) AS attachments_count,
  0::bigint AS reviewer_assignment_count,
  (SELECT count(*) FROM external_research_reviews v WHERE v.external_research_id = er.id) AS review_count,
  'unavailable'::text AS contract_status,
  0::bigint AS monev_count,
  0::bigint AS report_count,
  0::bigint AS funded_reviewer_assignment_count,
  0::bigint AS funded_review_count,
  0::bigint AS logbook_count
FROM external_research er;

CREATE VIEW user_archive_view AS
SELECT
  u.id,
  u.email,
  u.name,
  u.role,
  u.is_active,
  u.deactivation_reason,
  u.deactivated_at,
  rp.id AS profile_id,
  rp.nidn,
  rp.faculty,
  rp.study_program,
  rp.profile_status,
  rp.verification_status,
  rp.completeness,
  COALESCE((SELECT array_agg(s.scope::text ORDER BY s.scope::text) FROM user_admin_scopes s WHERE s.user_id = u.id), ARRAY[]::text[]) AS admin_scopes,
  (SELECT count(*) FROM researcher_documents d WHERE d.profile_id = rp.id AND d.is_active = true) AS profile_document_count,
  (SELECT count(*) FROM researcher_expertise_map e WHERE e.profile_id = rp.id) AS expertise_count,
  (SELECT count(*) FROM researcher_verifications v WHERE v.profile_id = rp.id) AS verification_history_count,
  (SELECT count(*) FROM researcher_status_history h WHERE h.profile_id = rp.id) AS status_history_count,
  (SELECT a.admin_id FROM admin_assignments a WHERE a.profile_id = rp.id ORDER BY a.assigned_at DESC LIMIT 1) AS assigned_admin_id,
  (SELECT count(*) FROM research_drafts d WHERE d.user_id = u.id) AS internal_research_count,
  (SELECT count(DISTINCT m.draft_id) FROM draft_members m JOIN research_drafts d ON d.id = m.draft_id WHERE d.user_id <> u.id AND (m.user_id = u.id OR m.profile_id = rp.id)) AS member_research_count,
  (SELECT count(*) FROM external_research e WHERE e.user_id = u.id) AS external_research_count,
  (SELECT count(*) FROM letter_requests l WHERE l.user_id = u.id OR l.created_by = u.id) AS letter_request_count,
  (SELECT count(*) FROM reviewer_assignments a WHERE a.reviewer_id = u.id) AS proposal_reviewer_assignment_count,
  (SELECT count(*) FROM funded_review_assignments a WHERE a.reviewer_id = u.id) AS funded_reviewer_assignment_count,
  (SELECT count(*) FROM temporary_role_assignments t WHERE t.user_id = u.id) AS active_temporary_role_count,
  GREATEST(u.updated_at, rp.updated_at) AS updated_at
FROM users u
LEFT JOIN researcher_profiles rp ON rp.user_id = u.id;

-- Automatically maintain updated_at on mutable tables.
DO $$
DECLARE
  target_table text;
BEGIN
  FOREACH target_table IN ARRAY ARRAY[
    'users',
    'researcher_profiles',
    'applicant_profiles',
    'schemes',
    'scheme_output_options',
    'scheme_attachment_requirements',
    'scheme_reporting_periods',
    'research_drafts',
    'draft_projects',
    'draft_budget_items',
    'draft_outputs',
    'submission_reviews',
    'funded_research',
    'research_contracts',
    'research_reports',
    'research_monev',
    'funded_reviews',
    'research_logbooks',
    'letter_master_templates',
    'letter_definitions',
    'letter_requests',
    'letter_request_templates',
    'letter_request_fields',
    'letter_request_values',
    'external_research',
    'email_outbox'
  ]
  LOOP
    EXECUTE format(
      'CREATE TRIGGER %I_set_updated_at BEFORE UPDATE ON %I
       FOR EACH ROW EXECUTE FUNCTION set_updated_at()',
      target_table,
      target_table
    );
  END LOOP;
END;
$$;

-- ---------------------------------------------------------------------
-- BEGIN GENERATED FRONTEND SEEDS
-- Generated by: node internals/scripts/generate-database-seed.js
-- Source: normalized app/containers/Ris/data.js. Run with TZ=Asia/Jakarta.
-- IDs are deterministic UUIDs; repeated child IDs are scoped to their parent.
-- Document metadata is preserved. Missing demo binaries are pending placeholders.
-- No notification/email/reminder rows are invented when their frontend lists are empty.

-- BEGIN SEED A: DEMO (ACTIVE)
INSERT INTO roles (code, name) VALUES
  ('super_admin', 'Super Admin'),
  ('manager', 'Manager LPPM'),
  ('admin', 'Admin'),
  ('lecturer', 'Dosen');

INSERT INTO admin_scopes (code, name) VALUES
  ('research_management', 'Manajemen Penelitian'),
  ('letter_management', 'Pengajuan Surat'),
  ('researcher_profile_management', 'Informasi Peneliti');

INSERT INTO sdg_goals (id, name) VALUES
  (1, 'No Poverty'),
  (2, 'Zero Hunger'),
  (3, 'Good Health and Well-being'),
  (4, 'Quality Education'),
  (5, 'Gender Equality'),
  (6, 'Clean Water and Sanitation'),
  (7, 'Affordable and Clean Energy'),
  (8, 'Decent Work and Economic Growth'),
  (9, 'Industry, Innovation and Infrastructure'),
  (10, 'Reduced Inequalities'),
  (11, 'Sustainable Cities and Communities'),
  (12, 'Responsible Consumption and Production'),
  (13, 'Climate Action'),
  (14, 'Life Below Water'),
  (15, 'Life on Land'),
  (16, 'Peace, Justice and Strong Institutions'),
  (17, 'Partnerships for the Goals');

INSERT INTO budget_categories (code, name, position) VALUES
  ('materials', 'Bahan dan Peralatan', 1),
  ('field', 'Pengumpulan Data', 2),
  ('analysis', 'Analisis Data', 3),
  ('reporting', 'Pelaporan Hasil Penelitian dan Luaran Wajib', 4);

INSERT INTO review_criteria (code, name, category, weight, position) VALUES
  ('kejelasan_masalah', 'Kejelasan masalah (1-100)', 'Kualitas Proposal (30%)', 10, 1),
  ('kebaruan_penelitian', 'Kebaruan penelitian (1-100)', 'Kualitas Proposal (30%)', 10, 2),
  ('metodologi', 'Metodologi (1-100)', 'Kualitas Proposal (30%)', 10, 3),
  ('kompetensi_ketua', 'Kompetensi ketua', 'Kelayakan Tim (15%)', 8, 4),
  ('komposisi_tim', 'Komposisi tim', 'Kelayakan Tim (15%)', 7, 5),
  ('kesesuaian_luaran', 'Kesesuaian Luaran Wajib', 'Luaran Penelitian (20%)', 10, 6),
  ('realisme_target', 'Realisme Target', 'Luaran Penelitian (20%)', 10, 7),
  ('kewajaran_biaya', 'Kewajaran Biaya', 'Anggaran (20%)', 10, 8),
  ('kesesuaian_kegiatan', 'Kesesuaian dengan Kegiatan', 'Anggaran (20%)', 10, 9),
  ('rip', 'RIP', 'Kesesuaian Strategis (15%)', 5, 10),
  ('sdg', 'SDG', 'Kesesuaian Strategis (15%)', 5, 11),
  ('research_center', 'Research Center', 'Kesesuaian Strategis (15%)', 5, 12);

INSERT INTO users (id, email, password_hash, name, role, is_active, applicant_enabled, default_mode, identifier, created_at, updated_at) VALUES
  ('50dee293-899a-5d23-aaa3-0eccc771558e', 'superadmin@umn.ac.id', crypt('password', gen_salt('bf', 12)), 'Super Admin RIS', 'super_admin', TRUE, FALSE, 'management', NULL, '2026-06-01T00:00:00.000Z', '2026-06-01T00:00:00.000Z'),
  ('9263f343-101a-5c74-8740-ad6e2958cd84', 'manager@umn.ac.id', crypt('password', gen_salt('bf', 12)), 'Manager LPPM', 'manager', TRUE, TRUE, 'management', NULL, '2026-06-01T00:00:00.000Z', '2026-06-01T00:00:00.000Z'),
  ('a578e542-9765-56f2-9e76-11ea5ba7fa89', 'admin.penelitian@umn.ac.id', crypt('password', gen_salt('bf', 12)), 'Admin Penelitian', 'admin', TRUE, FALSE, 'management', NULL, '2026-06-01T00:00:00.000Z', '2026-06-01T00:00:00.000Z'),
  ('3b35bd0a-39f9-5ff0-b419-f46cc0dee60e', 'admin.surat@umn.ac.id', crypt('password', gen_salt('bf', 12)), 'Admin Pengajuan Surat', 'admin', TRUE, FALSE, 'management', NULL, '2026-06-01T00:00:00.000Z', '2026-06-01T00:00:00.000Z'),
  ('97cf25f2-d2a0-51df-ac14-c93e42fc7e4f', 'admin.profil@umn.ac.id', crypt('password', gen_salt('bf', 12)), 'Admin Informasi Peneliti', 'admin', TRUE, FALSE, 'management', NULL, '2026-06-01T00:00:00.000Z', '2026-06-01T00:00:00.000Z'),
  ('7e8badc6-2777-5e2a-9c06-8a122d9a7f5b', 'lecturer@umn.ac.id', crypt('password', gen_salt('bf', 12)), 'Dr. Budi Santoso', 'lecturer', TRUE, TRUE, 'lecturer', NULL, '2026-06-01T00:00:00.000Z', '2026-06-01T00:00:00.000Z'),
  ('58be059f-f33c-58f2-ad60-561f8e5ad55c', 'reviewer@umn.ac.id', crypt('password', gen_salt('bf', 12)), 'Dr. Andini Prameswari', 'lecturer', TRUE, TRUE, 'lecturer', NULL, '2026-06-01T00:00:00.000Z', '2026-06-01T00:00:00.000Z'),
  ('08483b04-e38e-5602-b3de-2cd73d02fd40', 'rizky@umn.ac.id', crypt('password', gen_salt('bf', 12)), 'Rizky Kurniawan, M.T.', 'lecturer', TRUE, TRUE, 'lecturer', NULL, '2026-06-01T00:00:00.000Z', '2026-06-01T00:00:00.000Z'),
  ('547f62ba-dcce-55bc-b8ec-e27958656529', 'nadia@umn.ac.id', crypt('password', gen_salt('bf', 12)), 'Dr. Nadia Kusuma', 'lecturer', TRUE, TRUE, 'lecturer', NULL, '2026-06-01T00:00:00.000Z', '2026-06-01T00:00:00.000Z');

INSERT INTO user_admin_scopes (id, user_id, scope, assigned_by) VALUES
  ('e430e0bb-6e2a-52e0-b11e-782fe4cb4305', 'a578e542-9765-56f2-9e76-11ea5ba7fa89', 'research_management', '50dee293-899a-5d23-aaa3-0eccc771558e'),
  ('6a4fd648-79e1-556c-9158-931a43a87464', '3b35bd0a-39f9-5ff0-b419-f46cc0dee60e', 'letter_management', '50dee293-899a-5d23-aaa3-0eccc771558e'),
  ('1649e9a9-3eae-583e-8124-3f4c735680eb', '97cf25f2-d2a0-51df-ac14-c93e42fc7e4f', 'researcher_profile_management', '50dee293-899a-5d23-aaa3-0eccc771558e');

INSERT INTO stored_files (id, owner_user_id, storage_provider, storage_key, file_url, original_name, mime_type, extension, size_bytes, status, metadata, uploaded_at) VALUES
  ('a16ce007-709e-51dd-83b9-8b8fdf71264b', '7e8badc6-2777-5e2a-9c06-8a122d9a7f5b', 'demo', 'demo/profile/doc-ktp-1/ktp-budi.pdf', 'mock://researcher-documents/lecturer-1/ktp.pdf', 'ktp-budi.pdf', 'application/pdf', 'pdf', 1024000, 'pending', '{"sourceId":"doc-ktp-1","demoPlaceholder":true,"category":null}'::jsonb, '2026-01-12T03:00:00.000Z'),
  ('e9206c82-983a-5f7b-890e-c75517ff40e3', '7e8badc6-2777-5e2a-9c06-8a122d9a7f5b', 'demo', 'demo/profile/doc-cv-1/cv-budi.pdf', 'mock://researcher-documents/lecturer-1/cv.pdf', 'cv-budi.pdf', 'application/pdf', 'pdf', 2048000, 'pending', '{"sourceId":"doc-cv-1","demoPlaceholder":true,"category":null}'::jsonb, '2026-01-12T04:00:00.000Z'),
  ('308b001b-7446-5d3c-820f-ac3290dcdccf', '58be059f-f33c-58f2-ad60-561f8e5ad55c', 'demo', 'demo/profile/doc-ktp-2/ktp-andini.pdf', 'mock://researcher-documents/lecturer-2/ktp.pdf', 'ktp-andini.pdf', 'application/pdf', 'pdf', 1124000, 'pending', '{"sourceId":"doc-ktp-2","demoPlaceholder":true,"category":null}'::jsonb, '2026-02-01T03:00:00.000Z'),
  ('d372e70b-2ead-53f7-9f15-e600f933192a', '58be059f-f33c-58f2-ad60-561f8e5ad55c', 'demo', 'demo/profile/doc-cv-2/cv-andini.pdf', 'mock://researcher-documents/lecturer-2/cv.pdf', 'cv-andini.pdf', 'application/pdf', 'pdf', 1848000, 'pending', '{"sourceId":"doc-cv-2","demoPlaceholder":true,"category":null}'::jsonb, '2026-02-01T04:00:00.000Z'),
  ('1a99691a-69c5-51e1-a6d0-896ae9e80227', '08483b04-e38e-5602-b3de-2cd73d02fd40', 'demo', 'demo/profile/doc-cv-3/cv-rizky.pdf', 'mock://researcher-documents/lecturer-3/cv.pdf', 'cv-rizky.pdf', 'application/pdf', 'pdf', 1948000, 'pending', '{"sourceId":"doc-cv-3","demoPlaceholder":true,"category":null}'::jsonb, '2026-03-01T04:00:00.000Z'),
  ('7410f1ce-6043-5aca-ae17-b3ba715a496a', 'a578e542-9765-56f2-9e76-11ea5ba7fa89', 'demo', 'demo/profile/doc-ktp-admin/ktp-admin-lppm.pdf', 'mock://researcher-documents/admin-1/ktp.pdf', 'ktp-admin-lppm.pdf', 'application/pdf', 'pdf', 824000, 'pending', '{"sourceId":"doc-ktp-admin","demoPlaceholder":true,"category":null}'::jsonb, '2026-06-01T03:00:00.000Z'),
  ('a2ba47f0-de84-585d-97f7-31545f00648b', 'a578e542-9765-56f2-9e76-11ea5ba7fa89', 'demo', 'demo/profile/doc-cv-admin/cv-admin-lppm.pdf', 'mock://researcher-documents/admin-1/cv.pdf', 'cv-admin-lppm.pdf', 'application/pdf', 'pdf', 1284000, 'pending', '{"sourceId":"doc-cv-admin","demoPlaceholder":true,"category":null}'::jsonb, '2026-06-01T03:10:00.000Z'),
  ('c9d08bb6-34a3-5eac-bee2-97616da97414', '9263f343-101a-5c74-8740-ad6e2958cd84', 'demo', 'demo/profile/doc-ktp-manager/ktp-kepala-lppm.pdf', 'mock://researcher-documents/manager-1/ktp.pdf', 'ktp-kepala-lppm.pdf', 'application/pdf', 'pdf', 826000, 'pending', '{"sourceId":"doc-ktp-manager","demoPlaceholder":true,"category":null}'::jsonb, '2026-06-01T03:00:00.000Z'),
  ('f5b9947a-372e-585c-9d54-c619d58a9bfd', '9263f343-101a-5c74-8740-ad6e2958cd84', 'demo', 'demo/profile/doc-cv-manager/cv-kepala-lppm.pdf', 'mock://researcher-documents/manager-1/cv.pdf', 'cv-kepala-lppm.pdf', 'application/pdf', 'pdf', 1334000, 'pending', '{"sourceId":"doc-cv-manager","demoPlaceholder":true,"category":null}'::jsonb, '2026-06-01T03:10:00.000Z'),
  ('5de1dad1-b07f-56de-9d13-f86f277d34af', 'a578e542-9765-56f2-9e76-11ea5ba7fa89', 'demo', 'demo/scheme/scheme-demo-draft-2026/proposal/template-proposal-penelitian.doc', 'data:application/msword;charset=utf-8,%3Chtml%3E%3Cbody%3E%3Ch1%3ETemplate%20Proposal%20Penelitian%3C%2Fh1%3E%3Cp%3ETemplate%20demo%20RIS%20UMN.%20Lengkapi%20dokumen%20ini%20sesuai%20data%20penelitian.%3C%2Fp%3E%3C%2Fbody%3E%3C%2Fhtml%3E', 'template-proposal-penelitian.doc', 'application/msword', 'doc', 24576, 'ready', '{"sourceId":"template-demo-proposal","demoPlaceholder":false,"category":null}'::jsonb, '2026-06-01T00:00:00.000Z'),
  ('6ec0511d-b3f0-5c83-be66-7dec58c05ff6', 'a578e542-9765-56f2-9e76-11ea5ba7fa89', 'demo', 'demo/scheme/scheme-demo-draft-2026/rab/template-rab-penelitian.xls', 'data:application/vnd.ms-excel;charset=utf-8,%3Ctable%3E%3Ctr%3E%3Cth%3EKomponen%3C%2Fth%3E%3Cth%3EVolume%3C%2Fth%3E%3Cth%3EHarga%20Satuan%3C%2Fth%3E%3Cth%3ETotal%3C%2Fth%3E%3C%2Ftr%3E%3C%2Ftable%3E', 'template-rab-penelitian.xls', 'application/vnd.ms-excel', 'xls', 18432, 'ready', '{"sourceId":"template-demo-rab","demoPlaceholder":false,"category":null}'::jsonb, '2026-06-01T00:00:00.000Z'),
  ('d84b8f31-d224-5870-9531-daa91faa7e05', 'a578e542-9765-56f2-9e76-11ea5ba7fa89', 'demo', 'demo/scheme/scheme-demo-draft-2026/scheme_attachment_lead_statement/template-surat-pernyataan-ketua.doc', 'data:application/msword;charset=utf-8,%3Chtml%3E%3Cbody%3E%3Ch1%3ESurat%20Pernyataan%20Ketua%20Peneliti%3C%2Fh1%3E%3Cp%3ETemplate%20demo%20RIS%20UMN.%20Lengkapi%20dokumen%20ini%20sesuai%20data%20penelitian.%3C%2Fp%3E%3C%2Fbody%3E%3C%2Fhtml%3E', 'template-surat-pernyataan-ketua.doc', 'application/msword', 'doc', 24576, 'ready', '{"sourceId":"template-demo-lead-statement","demoPlaceholder":false,"category":null}'::jsonb, '2026-06-01T00:00:00.000Z'),
  ('0e34a6b0-0272-55dd-85f3-d22167a51259', 'a578e542-9765-56f2-9e76-11ea5ba7fa89', 'demo', 'demo/scheme/scheme-demo-draft-2026/scheme_attachment_partner_statement/template-surat-kesediaan-mitra.doc', 'data:application/msword;charset=utf-8,%3Chtml%3E%3Cbody%3E%3Ch1%3ESurat%20Kesediaan%20Mitra%3C%2Fh1%3E%3Cp%3ETemplate%20demo%20RIS%20UMN.%20Lengkapi%20dokumen%20ini%20sesuai%20data%20penelitian.%3C%2Fp%3E%3C%2Fbody%3E%3C%2Fhtml%3E', 'template-surat-kesediaan-mitra.doc', 'application/msword', 'doc', 24576, 'ready', '{"sourceId":"template-demo-partner-statement","demoPlaceholder":false,"category":null}'::jsonb, '2026-06-01T00:00:00.000Z'),
  ('c68c9875-5401-53c4-8d36-3759069e8ecc', 'a578e542-9765-56f2-9e76-11ea5ba7fa89', 'demo', 'demo/scheme/scheme-demo-draft-2026/scheme_attachment_integrity_pact/template-pakta-integritas.doc', 'data:application/msword;charset=utf-8,%3Chtml%3E%3Cbody%3E%3Ch1%3EPakta%20Integritas%20Tim%20Peneliti%3C%2Fh1%3E%3Cp%3ETemplate%20demo%20RIS%20UMN.%20Lengkapi%20dokumen%20ini%20sesuai%20data%20penelitian.%3C%2Fp%3E%3C%2Fbody%3E%3C%2Fhtml%3E', 'template-pakta-integritas.doc', 'application/msword', 'doc', 24576, 'ready', '{"sourceId":"template-demo-integrity-pact","demoPlaceholder":false,"category":null}'::jsonb, '2026-06-01T00:00:00.000Z'),
  ('36de7a31-fd54-5c27-a5b2-27207a59e6c5', 'a578e542-9765-56f2-9e76-11ea5ba7fa89', 'demo', 'demo/scheme/scheme-demo-draft-2026/scheme_attachment_team_cv/template-biodata-tim-peneliti.doc', 'data:application/msword;charset=utf-8,%3Chtml%3E%3Cbody%3E%3Ch1%3EBiodata%20Tim%20Peneliti%3C%2Fh1%3E%3Cp%3ETemplate%20demo%20RIS%20UMN.%20Lengkapi%20dokumen%20ini%20sesuai%20data%20penelitian.%3C%2Fp%3E%3C%2Fbody%3E%3C%2Fhtml%3E', 'template-biodata-tim-peneliti.doc', 'application/msword', 'doc', 24576, 'ready', '{"sourceId":"template-demo-team-cv","demoPlaceholder":false,"category":null}'::jsonb, '2026-06-01T00:00:00.000Z'),
  ('ad8365c2-2afe-586a-a344-98c7abf3b08b', 'a578e542-9765-56f2-9e76-11ea5ba7fa89', 'demo', 'demo/scheme/scheme-demo-clean-2026/proposal/template-proposal-penelitian.doc', 'data:application/msword;charset=utf-8,%3Chtml%3E%3Cbody%3E%3Ch1%3ETemplate%20Proposal%20Penelitian%3C%2Fh1%3E%3Cp%3ETemplate%20demo%20RIS%20UMN.%20Lengkapi%20dokumen%20ini%20sesuai%20data%20penelitian.%3C%2Fp%3E%3C%2Fbody%3E%3C%2Fhtml%3E', 'template-proposal-penelitian.doc', 'application/msword', 'doc', 24576, 'ready', '{"sourceId":"template-demo-proposal","demoPlaceholder":false,"category":null}'::jsonb, '2026-06-01T00:00:00.000Z'),
  ('af584181-b9a3-5d66-b733-4fc1921f48b1', 'a578e542-9765-56f2-9e76-11ea5ba7fa89', 'demo', 'demo/scheme/scheme-demo-clean-2026/rab/template-rab-penelitian.xls', 'data:application/vnd.ms-excel;charset=utf-8,%3Ctable%3E%3Ctr%3E%3Cth%3EKomponen%3C%2Fth%3E%3Cth%3EVolume%3C%2Fth%3E%3Cth%3EHarga%20Satuan%3C%2Fth%3E%3Cth%3ETotal%3C%2Fth%3E%3C%2Ftr%3E%3C%2Ftable%3E', 'template-rab-penelitian.xls', 'application/vnd.ms-excel', 'xls', 18432, 'ready', '{"sourceId":"template-demo-rab","demoPlaceholder":false,"category":null}'::jsonb, '2026-06-01T00:00:00.000Z'),
  ('9e8650e6-b8dd-5848-b71d-2209f9ceddf1', 'a578e542-9765-56f2-9e76-11ea5ba7fa89', 'demo', 'demo/scheme/scheme-demo-clean-2026/scheme_attachment_lead_statement/template-surat-pernyataan-ketua.doc', 'data:application/msword;charset=utf-8,%3Chtml%3E%3Cbody%3E%3Ch1%3ESurat%20Pernyataan%20Ketua%20Peneliti%3C%2Fh1%3E%3Cp%3ETemplate%20demo%20RIS%20UMN.%20Lengkapi%20dokumen%20ini%20sesuai%20data%20penelitian.%3C%2Fp%3E%3C%2Fbody%3E%3C%2Fhtml%3E', 'template-surat-pernyataan-ketua.doc', 'application/msword', 'doc', 24576, 'ready', '{"sourceId":"template-demo-lead-statement","demoPlaceholder":false,"category":null}'::jsonb, '2026-06-01T00:00:00.000Z'),
  ('f2697a8c-3bb1-5f58-82d2-eae85ee43bfa', 'a578e542-9765-56f2-9e76-11ea5ba7fa89', 'demo', 'demo/scheme/scheme-demo-clean-2026/scheme_attachment_partner_statement/template-surat-kesediaan-mitra.doc', 'data:application/msword;charset=utf-8,%3Chtml%3E%3Cbody%3E%3Ch1%3ESurat%20Kesediaan%20Mitra%3C%2Fh1%3E%3Cp%3ETemplate%20demo%20RIS%20UMN.%20Lengkapi%20dokumen%20ini%20sesuai%20data%20penelitian.%3C%2Fp%3E%3C%2Fbody%3E%3C%2Fhtml%3E', 'template-surat-kesediaan-mitra.doc', 'application/msword', 'doc', 24576, 'ready', '{"sourceId":"template-demo-partner-statement","demoPlaceholder":false,"category":null}'::jsonb, '2026-06-01T00:00:00.000Z'),
  ('a3525d4a-a8bc-5eb4-89a8-c1c0fdf26a0e', 'a578e542-9765-56f2-9e76-11ea5ba7fa89', 'demo', 'demo/scheme/scheme-demo-clean-2026/scheme_attachment_integrity_pact/template-pakta-integritas.doc', 'data:application/msword;charset=utf-8,%3Chtml%3E%3Cbody%3E%3Ch1%3EPakta%20Integritas%20Tim%20Peneliti%3C%2Fh1%3E%3Cp%3ETemplate%20demo%20RIS%20UMN.%20Lengkapi%20dokumen%20ini%20sesuai%20data%20penelitian.%3C%2Fp%3E%3C%2Fbody%3E%3C%2Fhtml%3E', 'template-pakta-integritas.doc', 'application/msword', 'doc', 24576, 'ready', '{"sourceId":"template-demo-integrity-pact","demoPlaceholder":false,"category":null}'::jsonb, '2026-06-01T00:00:00.000Z'),
  ('d857cc74-546a-5a38-9af3-192d98de11b9', 'a578e542-9765-56f2-9e76-11ea5ba7fa89', 'demo', 'demo/scheme/scheme-demo-clean-2026/scheme_attachment_team_cv/template-biodata-tim-peneliti.doc', 'data:application/msword;charset=utf-8,%3Chtml%3E%3Cbody%3E%3Ch1%3EBiodata%20Tim%20Peneliti%3C%2Fh1%3E%3Cp%3ETemplate%20demo%20RIS%20UMN.%20Lengkapi%20dokumen%20ini%20sesuai%20data%20penelitian.%3C%2Fp%3E%3C%2Fbody%3E%3C%2Fhtml%3E', 'template-biodata-tim-peneliti.doc', 'application/msword', 'doc', 24576, 'ready', '{"sourceId":"template-demo-team-cv","demoPlaceholder":false,"category":null}'::jsonb, '2026-06-01T00:00:00.000Z'),
  ('ced94c08-80c5-5612-9022-194207541a59', '7e8badc6-2777-5e2a-9c06-8a122d9a7f5b', 'demo', 'demo/proposal/draft-submitted/file-1/proposal-penelitian.pdf', NULL, 'proposal-penelitian.pdf', 'application/pdf', 'pdf', 1843200, 'pending', '{"sourceId":"file-1","demoPlaceholder":true,"category":"proposal"}'::jsonb, '2026-06-01T00:00:00.000Z'),
  ('2fda302a-bd12-5d52-9d75-7f70022f0cda', '7e8badc6-2777-5e2a-9c06-8a122d9a7f5b', 'demo', 'demo/proposal/draft-submitted/file-2/rab-penelitian.xlsx', NULL, 'rab-penelitian.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'xlsx', 245760, 'pending', '{"sourceId":"file-2","demoPlaceholder":true,"category":"rab"}'::jsonb, '2026-06-01T00:00:00.000Z'),
  ('213b5ee7-e10d-50de-a396-5b3013ced633', '7e8badc6-2777-5e2a-9c06-8a122d9a7f5b', 'demo', 'demo/proposal/draft-assigned/file-1/proposal-penelitian.pdf', NULL, 'proposal-penelitian.pdf', 'application/pdf', 'pdf', 1843200, 'pending', '{"sourceId":"file-1","demoPlaceholder":true,"category":"proposal"}'::jsonb, '2026-06-01T00:00:00.000Z'),
  ('a08e3dca-08a8-5f6d-9535-34b9eb8b4fcb', '7e8badc6-2777-5e2a-9c06-8a122d9a7f5b', 'demo', 'demo/proposal/draft-assigned/file-2/rab-penelitian.xlsx', NULL, 'rab-penelitian.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'xlsx', 245760, 'pending', '{"sourceId":"file-2","demoPlaceholder":true,"category":"rab"}'::jsonb, '2026-06-01T00:00:00.000Z'),
  ('17ab9053-7a29-5c26-8927-0fa470160572', '7e8badc6-2777-5e2a-9c06-8a122d9a7f5b', 'demo', 'demo/proposal/draft-reviewed/file-1/proposal-penelitian.pdf', NULL, 'proposal-penelitian.pdf', 'application/pdf', 'pdf', 1843200, 'pending', '{"sourceId":"file-1","demoPlaceholder":true,"category":"proposal"}'::jsonb, '2026-06-01T00:00:00.000Z'),
  ('3f51b40e-d76b-5f42-b4b9-d0f73bebce80', '7e8badc6-2777-5e2a-9c06-8a122d9a7f5b', 'demo', 'demo/proposal/draft-reviewed/file-2/rab-penelitian.xlsx', NULL, 'rab-penelitian.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'xlsx', 245760, 'pending', '{"sourceId":"file-2","demoPlaceholder":true,"category":"rab"}'::jsonb, '2026-06-01T00:00:00.000Z'),
  ('0a7564d5-c3d1-544d-977c-a6d643cbff37', '7e8badc6-2777-5e2a-9c06-8a122d9a7f5b', 'demo', 'demo/proposal/draft-approved/file-1/proposal-penelitian.pdf', NULL, 'proposal-penelitian.pdf', 'application/pdf', 'pdf', 1843200, 'pending', '{"sourceId":"file-1","demoPlaceholder":true,"category":"proposal"}'::jsonb, '2026-06-01T00:00:00.000Z'),
  ('5c9e73d1-49c4-5e1a-8796-959f7ac39768', '7e8badc6-2777-5e2a-9c06-8a122d9a7f5b', 'demo', 'demo/proposal/draft-approved/file-2/rab-penelitian.xlsx', NULL, 'rab-penelitian.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'xlsx', 245760, 'pending', '{"sourceId":"file-2","demoPlaceholder":true,"category":"rab"}'::jsonb, '2026-06-01T00:00:00.000Z'),
  ('64d7fd4a-14de-5ecb-ab04-ddef65f01b37', '7e8badc6-2777-5e2a-9c06-8a122d9a7f5b', 'demo', 'demo/proposal/draft-demo-saved/file-1/proposal-penelitian.pdf', NULL, 'proposal-penelitian.pdf', 'application/pdf', 'pdf', 1843200, 'pending', '{"sourceId":"file-1","demoPlaceholder":true,"category":"proposal"}'::jsonb, '2026-06-01T00:00:00.000Z'),
  ('36973866-5ee0-5917-aceb-1941ffecafa0', '7e8badc6-2777-5e2a-9c06-8a122d9a7f5b', 'demo', 'demo/proposal/draft-demo-saved/file-2/rab-penelitian.xlsx', NULL, 'rab-penelitian.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'xlsx', 245760, 'pending', '{"sourceId":"file-2","demoPlaceholder":true,"category":"rab"}'::jsonb, '2026-06-01T00:00:00.000Z'),
  ('dd4a1818-1c3b-5611-a19b-ffee431af5ae', '7e8badc6-2777-5e2a-9c06-8a122d9a7f5b', 'demo', 'demo/report/internal-report-demo-interim-1/laporan-sementara-periode-1.pdf', NULL, 'laporan-sementara-periode-1.pdf', 'application/pdf', 'pdf', 1258291, 'pending', '{"sourceId":"file-report-demo-1","demoPlaceholder":true,"category":"internal_report"}'::jsonb, '2026-06-01T00:00:00.000Z'),
  ('18dda81a-7376-511e-8e16-894f36a195f5', 'a578e542-9765-56f2-9e76-11ea5ba7fa89', 'demo', 'demo/monev/monev-demo-interim-1/bukti-monev-periode-1.pdf', NULL, 'bukti-monev-periode-1.pdf', 'application/pdf', 'pdf', 786432, 'pending', '{"sourceId":"file-monev-demo-1","demoPlaceholder":true,"category":"monev"}'::jsonb, '2026-06-01T00:00:00.000Z'),
  ('0c77760e-6b70-5377-834e-96804fb302c6', '7e8badc6-2777-5e2a-9c06-8a122d9a7f5b', 'demo', 'demo/external/external-report-1/external-file-1/proposal-hibah.pdf', 'proposal-hibah.pdf', 'proposal-hibah.pdf', 'application/pdf', 'pdf', 1200000, 'pending', '{"sourceId":"external-file-1","demoPlaceholder":true,"category":"proposal"}'::jsonb, '2026-06-03T02:00:00.000Z'),
  ('ea767457-59f2-502e-8331-3a74d92ac0fd', '7e8badc6-2777-5e2a-9c06-8a122d9a7f5b', 'demo', 'demo/external/external-report-1/external-file-2/rab-hibah.xlsx', 'rab-hibah.xlsx', 'rab-hibah.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'xlsx', 350000, 'pending', '{"sourceId":"external-file-2","demoPlaceholder":true,"category":"budget_plan"}'::jsonb, '2026-06-03T02:00:00.000Z'),
  ('16f6feba-9cfe-5306-ae8c-3c915cf38ef3', '7e8badc6-2777-5e2a-9c06-8a122d9a7f5b', 'demo', 'demo/external/external-report-1/external-file-3/kontrak-hibah.pdf', 'kontrak-hibah.pdf', 'kontrak-hibah.pdf', 'application/pdf', 'pdf', 500000, 'pending', '{"sourceId":"external-file-3","demoPlaceholder":true,"category":"contract"}'::jsonb, '2026-06-03T02:00:00.000Z'),
  ('a8c2ee44-88bf-5b57-bebe-7cf88c1a8afe', '7e8badc6-2777-5e2a-9c06-8a122d9a7f5b', 'demo', 'demo/external/external-report-1/external-teach-proof-1/rps-data-mining.pdf', 'rps-data-mining.pdf', 'rps-data-mining.pdf', 'application/pdf', 'pdf', 280000, 'pending', '{"sourceId":"external-teach-proof-1","demoPlaceholder":true,"category":"integration_proof"}'::jsonb, '2026-06-01T00:00:00.000Z'),
  ('54f69df9-c114-5fe5-97aa-b87c59410e07', '7e8badc6-2777-5e2a-9c06-8a122d9a7f5b', 'demo', 'demo/external/external-report-2/external-file-4/proposal-prostep.pdf', 'proposal-prostep.pdf', 'proposal-prostep.pdf', 'application/pdf', 'pdf', 920000, 'pending', '{"sourceId":"external-file-4","demoPlaceholder":true,"category":"proposal"}'::jsonb, '2025-11-03T02:00:00.000Z'),
  ('3d184e98-41f8-527a-98df-ac303e43272b', '7e8badc6-2777-5e2a-9c06-8a122d9a7f5b', 'demo', 'demo/external/external-report-2/external-file-5/rab-prostep.xlsx', 'rab-prostep.xlsx', 'rab-prostep.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'xlsx', 210000, 'pending', '{"sourceId":"external-file-5","demoPlaceholder":true,"category":"budget_plan"}'::jsonb, '2025-11-03T02:00:00.000Z'),
  ('8b389b0d-c945-53b7-ac21-748d959efb97', '7e8badc6-2777-5e2a-9c06-8a122d9a7f5b', 'demo', 'demo/external/external-report-2/external-file-6/surat-tugas-prostep.pdf', 'surat-tugas-prostep.pdf', 'surat-tugas-prostep.pdf', 'application/pdf', 'pdf', 320000, 'pending', '{"sourceId":"external-file-6","demoPlaceholder":true,"category":"contract"}'::jsonb, '2025-11-03T02:00:00.000Z'),
  ('43b304a7-b788-5e8d-baac-d1f1b972f1ff', '7e8badc6-2777-5e2a-9c06-8a122d9a7f5b', 'demo', 'demo/external/external-report-2/external-file-7/laporan-akhir-prostep.pdf', 'laporan-akhir-prostep.pdf', 'laporan-akhir-prostep.pdf', 'application/pdf', 'pdf', 1800000, 'pending', '{"sourceId":"external-file-7","demoPlaceholder":true,"category":"final_report"}'::jsonb, '2025-12-12T02:00:00.000Z');

INSERT INTO researcher_profiles (id, user_id, full_name, front_title, back_title, nidn, nik, nip, birth_place, birth_date, gender, nationality, institution_email, alternate_email, phone_number, domicile_address, correspondence_address, faculty, study_program, unit, position, functional_position, education_level, employment_status, orcid, google_scholar, sinta_id, bank_name, bank_account_number, bank_account_name, emergency_contact_name, emergency_contact_relation, emergency_contact_phone, sinta_score, research_count, last_research_year, profile_status, verification_status, completeness, last_updated_by, created_at, updated_at) VALUES
  ('1a826f2d-8c7e-52ca-abfc-8ae75f1cb6c4', '7e8badc6-2777-5e2a-9c06-8a122d9a7f5b', 'Budi Santoso', 'Dr.', NULL, '0312048501', '3671010101850001', '201203001', 'Jakarta', '1985-12-04', 'Laki-laki', 'Indonesia', 'lecturer@umn.ac.id', 'budi.santoso@example.com', '081234567890', 'Tangerang', 'Tangerang', 'Teknik dan Informatika', 'Sistem Informasi', 'LPPM', 'Dosen Fulltime', 'Lektor', 'S3', 'fulltime', '0000000218250097', 'https://scholar.google.com/citations?user=budi', '612001', 'BCA', '1234567890', 'Budi Santoso', 'Dewi Santoso', 'Istri', '081299988877', 612, 14, 2026, 'active', 'verified', 100, 'a578e542-9765-56f2-9e76-11ea5ba7fa89', '2026-01-10T03:00:00.000Z', '2026-06-05T03:00:00.000Z'),
  ('9d5ccc3c-ac0a-51df-b375-5fe8699dcaeb', '58be059f-f33c-58f2-ad60-561f8e5ad55c', 'Andini Prameswari', 'Dr.', NULL, '0308078602', '3671010807860002', '201108002', 'Bandung', '1986-07-08', 'Perempuan', 'Indonesia', 'reviewer@umn.ac.id', NULL, '081233344455', 'Tangerang Selatan', 'Tangerang Selatan', 'Teknik dan Informatika', 'Informatika', 'Fakultas Teknik dan Informatika', 'Dosen Homebase', 'Lektor Kepala', 'S3', 'homebase', '0000000319261188', 'https://scholar.google.com/citations?user=andini', '780002', 'Mandiri', '9876543210', 'Andini Prameswari', 'Raka Prameswara', 'Suami', '081277766655', 780, 20, 2026, 'active', 'pending', 100, '58be059f-f33c-58f2-ad60-561f8e5ad55c', '2026-01-11T03:00:00.000Z', '2026-06-12T03:00:00.000Z'),
  ('90b058a5-8612-509d-aeee-65aa94f43794', '08483b04-e38e-5602-b3de-2cd73d02fd40', 'Rizky Kurniawan', NULL, 'M.T.', '0321019003', NULL, NULL, NULL, NULL, 'Laki-laki', 'Indonesia', 'rizky@umn.ac.id', NULL, '081211122233', NULL, NULL, 'Teknik dan Informatika', 'Teknik Komputer', NULL, 'Dosen Fulltime', 'Asisten Ahli', 'S2', 'fulltime', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 388, 7, 2025, 'draft', 'pending', 73, '08483b04-e38e-5602-b3de-2cd73d02fd40', '2026-02-01T03:00:00.000Z', '2026-06-15T03:00:00.000Z'),
  ('20fe4bf3-169c-5a09-b54e-d52794bb08a2', '547f62ba-dcce-55bc-b8ec-e27958656529', 'Nadia Kusuma', 'Dr.', NULL, '0317098804', '3671011709880004', '201407004', 'Surabaya', '1988-09-17', 'Perempuan', 'Indonesia', 'nadia@umn.ac.id', NULL, '081266655544', 'Jakarta Barat', 'Jakarta Barat', 'Bisnis', 'Manajemen', 'Fakultas Bisnis', 'Dosen Homebase', 'Lektor', 'S3', 'homebase', NULL, 'https://scholar.google.com/citations?user=nadia', '540004', 'BNI', '7654321000', 'Nadia Kusuma', 'Ari Kusuma', 'Saudara', '081255544433', 540, 11, 2026, 'active', 'unverified', 70, '547f62ba-dcce-55bc-b8ec-e27958656529', '2026-01-20T03:00:00.000Z', '2026-05-10T03:00:00.000Z'),
  ('77e9145a-670d-5e1f-a859-686038e12a87', 'a578e542-9765-56f2-9e76-11ea5ba7fa89', 'Admin Penelitian', NULL, NULL, 'ADM-RIS-001', '3671010101900005', 'ADM001', 'Tangerang', '1990-01-01', 'Laki-laki', 'Indonesia', 'admin.penelitian@umn.ac.id', NULL, '081200000001', 'Tangerang', 'Universitas Multimedia Nusantara', 'LPPM', 'Administrasi Riset', 'LPPM', 'Admin Penelitian', 'Administrator', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, 0, NULL, 'active', 'verified', 85, '9263f343-101a-5c74-8740-ad6e2958cd84', '2026-06-01T03:00:00.000Z', '2026-06-01T03:00:00.000Z'),
  ('69b7d8c0-b8d3-51c9-aefb-182500d53c69', '3b35bd0a-39f9-5ff0-b419-f46cc0dee60e', 'Admin Pengajuan Surat', NULL, NULL, 'ADM-SRT-001', NULL, 'ADMSRT001', NULL, NULL, NULL, 'Indonesia', 'admin.surat@umn.ac.id', NULL, NULL, NULL, 'Universitas Multimedia Nusantara', 'LPPM', 'Administrasi Riset', 'LPPM', 'Admin Pengajuan Surat', 'Administrator', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, 0, NULL, 'active', 'verified', 51, '9263f343-101a-5c74-8740-ad6e2958cd84', '2026-06-01T03:00:00.000Z', '2026-06-01T03:00:00.000Z'),
  ('8a24a802-b79a-5c5b-a45a-33c9671e2242', '97cf25f2-d2a0-51df-ac14-c93e42fc7e4f', 'Admin Informasi Peneliti', NULL, NULL, 'ADM-PRF-001', NULL, 'ADMPRF001', NULL, NULL, NULL, 'Indonesia', 'admin.profil@umn.ac.id', NULL, NULL, NULL, 'Universitas Multimedia Nusantara', 'LPPM', 'Administrasi Riset', 'LPPM', 'Admin Informasi Peneliti', 'Administrator', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, 0, NULL, 'active', 'verified', 51, '9263f343-101a-5c74-8740-ad6e2958cd84', '2026-06-01T03:00:00.000Z', '2026-06-01T03:00:00.000Z'),
  ('899e9275-9164-58dc-8388-7146167118ac', '9263f343-101a-5c74-8740-ad6e2958cd84', 'Kepala LPPM', NULL, NULL, 'MGR-LPPM-001', '3671010101880006', 'MGR001', 'Tangerang', '1988-01-01', 'Laki-laki', 'Indonesia', 'manager@umn.ac.id', NULL, '081200000002', 'Tangerang', 'Universitas Multimedia Nusantara', 'LPPM', 'Manajemen Riset', 'LPPM', 'Kepala LPPM', 'Manager', 'S3', 'fulltime', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, 0, 2026, 'active', 'verified', 85, '9263f343-101a-5c74-8740-ad6e2958cd84', '2026-06-01T03:00:00.000Z', '2026-06-01T03:00:00.000Z'),
  ('25ef7d31-f651-54fc-a60d-ce1526ff5599', '50dee293-899a-5d23-aaa3-0eccc771558e', 'Super Admin RIS', NULL, NULL, 'SADM-RIS-001', NULL, 'SADM001', NULL, NULL, NULL, 'Indonesia', 'superadmin@umn.ac.id', NULL, NULL, NULL, 'Universitas Multimedia Nusantara', 'LPPM', 'Manajemen Sistem Riset', 'LPPM', 'Super Admin', 'Super Administrator', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, 0, NULL, 'active', 'verified', 51, '50dee293-899a-5d23-aaa3-0eccc771558e', '2026-06-01T03:00:00.000Z', '2026-06-01T03:00:00.000Z');

INSERT INTO researcher_documents (id, profile_id, document_type, file_id, uploaded_by, is_active, uploaded_at) VALUES
  ('ace77cec-b0e6-56ca-9226-f495bc31ee23', '1a826f2d-8c7e-52ca-abfc-8ae75f1cb6c4', 'KTP', 'a16ce007-709e-51dd-83b9-8b8fdf71264b', '7e8badc6-2777-5e2a-9c06-8a122d9a7f5b', TRUE, '2026-01-12T03:00:00.000Z'),
  ('91dd5848-9284-5b6a-bf56-90a57343b4b8', '1a826f2d-8c7e-52ca-abfc-8ae75f1cb6c4', 'CV', 'e9206c82-983a-5f7b-890e-c75517ff40e3', '7e8badc6-2777-5e2a-9c06-8a122d9a7f5b', TRUE, '2026-01-12T04:00:00.000Z'),
  ('b9a20777-130a-5e4e-994a-cc21267ab87c', '9d5ccc3c-ac0a-51df-b375-5fe8699dcaeb', 'KTP', '308b001b-7446-5d3c-820f-ac3290dcdccf', '58be059f-f33c-58f2-ad60-561f8e5ad55c', TRUE, '2026-02-01T03:00:00.000Z'),
  ('7d7c033b-531e-5d41-96b2-f58747004ee6', '9d5ccc3c-ac0a-51df-b375-5fe8699dcaeb', 'CV', 'd372e70b-2ead-53f7-9f15-e600f933192a', '58be059f-f33c-58f2-ad60-561f8e5ad55c', TRUE, '2026-02-01T04:00:00.000Z'),
  ('85f2b5ab-6130-52c1-b38f-65b0f11eb6fa', '90b058a5-8612-509d-aeee-65aa94f43794', 'CV', '1a99691a-69c5-51e1-a6d0-896ae9e80227', '08483b04-e38e-5602-b3de-2cd73d02fd40', TRUE, '2026-03-01T04:00:00.000Z'),
  ('d0b02944-7eac-5a15-bea6-5d08bc3adb43', '77e9145a-670d-5e1f-a859-686038e12a87', 'KTP', '7410f1ce-6043-5aca-ae17-b3ba715a496a', 'a578e542-9765-56f2-9e76-11ea5ba7fa89', TRUE, '2026-06-01T03:00:00.000Z'),
  ('2d1b9199-4af1-5a33-8aea-a6c8e7138d70', '77e9145a-670d-5e1f-a859-686038e12a87', 'CV', 'a2ba47f0-de84-585d-97f7-31545f00648b', 'a578e542-9765-56f2-9e76-11ea5ba7fa89', TRUE, '2026-06-01T03:10:00.000Z'),
  ('ff7a4af0-7b51-5a80-8c30-a23ad2336e7d', '899e9275-9164-58dc-8388-7146167118ac', 'KTP', 'c9d08bb6-34a3-5eac-bee2-97616da97414', '9263f343-101a-5c74-8740-ad6e2958cd84', TRUE, '2026-06-01T03:00:00.000Z'),
  ('2d6c0636-2c2e-5f46-9c92-a36a3b186708', '899e9275-9164-58dc-8388-7146167118ac', 'CV', 'f5b9947a-372e-585c-9d54-c619d58a9bfd', '9263f343-101a-5c74-8740-ad6e2958cd84', TRUE, '2026-06-01T03:10:00.000Z');

INSERT INTO researcher_expertise (id, name) VALUES
  ('c8735af1-e049-5091-a3e8-7ce31a74cc7e', 'Artificial Intelligence'),
  ('1dfeb217-0c68-52bf-8cbe-3ab3f9401578', 'Machine Learning'),
  ('bc66a21a-c5fe-593a-9032-4f717c1b08cf', 'Computer Vision'),
  ('42e1923a-4a71-5c98-a4e0-de101c2cfce5', 'Sistem Informasi'),
  ('62918cdc-5dc1-5f12-8675-defc0a5cc5d8', 'Data Science'),
  ('dfa21cac-43a4-5cdc-a069-2ce9bc061618', 'Digital Business');

INSERT INTO researcher_expertise_map (profile_id, expertise_id, is_primary) VALUES
  ('1a826f2d-8c7e-52ca-abfc-8ae75f1cb6c4', 'c8735af1-e049-5091-a3e8-7ce31a74cc7e', FALSE),
  ('1a826f2d-8c7e-52ca-abfc-8ae75f1cb6c4', '1dfeb217-0c68-52bf-8cbe-3ab3f9401578', FALSE),
  ('1a826f2d-8c7e-52ca-abfc-8ae75f1cb6c4', '42e1923a-4a71-5c98-a4e0-de101c2cfce5', FALSE),
  ('9d5ccc3c-ac0a-51df-b375-5fe8699dcaeb', 'c8735af1-e049-5091-a3e8-7ce31a74cc7e', FALSE),
  ('9d5ccc3c-ac0a-51df-b375-5fe8699dcaeb', 'bc66a21a-c5fe-593a-9032-4f717c1b08cf', FALSE),
  ('20fe4bf3-169c-5a09-b54e-d52794bb08a2', 'dfa21cac-43a4-5cdc-a069-2ce9bc061618', FALSE);

INSERT INTO researcher_verifications (id, profile_id, status, notes, verified_by, verified_at, created_at) VALUES
  ('92aedbc8-5c2a-5730-8f51-a9c2b980e916', '1a826f2d-8c7e-52ca-abfc-8ae75f1cb6c4', 'verified', 'Profil dan dokumen utama lengkap.', 'a578e542-9765-56f2-9e76-11ea5ba7fa89', '2026-06-05T03:00:00.000Z', '2026-06-05T03:00:00.000Z');

INSERT INTO researcher_status_history (id, profile_id, old_status, new_status, reason, changed_by, changed_at) VALUES
  ('8a5dfbb0-3501-5550-85de-1e2f1ffe0022', '1a826f2d-8c7e-52ca-abfc-8ae75f1cb6c4', 'draft', 'active', NULL, 'a578e542-9765-56f2-9e76-11ea5ba7fa89', '2026-06-05T03:00:00.000Z');

INSERT INTO admin_assignments (id, profile_id, admin_id, assigned_by, assigned_at) VALUES
  ('53c572a2-b09f-5a8f-ab4e-9c69a43a5595', '1a826f2d-8c7e-52ca-abfc-8ae75f1cb6c4', '97cf25f2-d2a0-51df-ac14-c93e42fc7e4f', '9263f343-101a-5c74-8740-ad6e2958cd84', '2026-06-05T03:00:00.000Z'),
  ('3005bcab-35cf-570d-a1f8-99e560d64dd7', '9d5ccc3c-ac0a-51df-b375-5fe8699dcaeb', '97cf25f2-d2a0-51df-ac14-c93e42fc7e4f', '9263f343-101a-5c74-8740-ad6e2958cd84', '2026-06-12T03:00:00.000Z');

INSERT INTO applicant_profiles (id, user_id, name, identifier, applicant_role, applicant_kind, status, faculty, study_program, email) VALUES
  ('04ce8cc9-e61e-505b-966c-706e78501a75', '7e8badc6-2777-5e2a-9c06-8a122d9a7f5b', 'Dr. Budi Santoso', '0312048501', 'Dosen Fulltime', 'lecturer', 'fulltime', 'Teknik dan Informatika', 'Sistem Informasi', 'lecturer@umn.ac.id'),
  ('d752c980-8f34-5913-9b5b-7e1f0d9a1d4c', '58be059f-f33c-58f2-ad60-561f8e5ad55c', 'Dr. Andini Prameswari', '0308078602', 'Dosen Homebase', 'lecturer', 'homebase', 'Teknik dan Informatika', 'Informatika', 'lecturer-2@umn.ac.id'),
  ('7eb43cc1-508a-5068-99ca-15ff9af9717d', '08483b04-e38e-5602-b3de-2cd73d02fd40', 'Rizky Kurniawan, M.T.', '0321019003', 'Dosen Fulltime', 'lecturer', 'fulltime', 'Teknik dan Informatika', 'Teknik Komputer', 'lecturer-3@umn.ac.id'),
  ('5cadee9b-937f-5e70-be8a-4c8cf50882cf', '547f62ba-dcce-55bc-b8ec-e27958656529', 'Dr. Nadia Kusuma', '0317098804', 'Dosen Homebase', 'lecturer', 'homebase', 'Bisnis', 'Manajemen', 'lecturer-4@umn.ac.id'),
  ('ccc8dc42-0de6-535c-a00d-7c5a33a1085b', '9263f343-101a-5c74-8740-ad6e2958cd84', 'Manager LPPM', 'MGR-LPPM-001', 'Dosen Fulltime', 'lecturer', 'fulltime', 'LPPM', 'Manajemen Riset', 'manager@umn.ac.id'),
  ('7ea46f91-3f86-58a4-bc32-1702fcf4322c', NULL, 'Ayu Larasati', '00000078910', 'Mahasiswa S1', 'student_s1', 'active', 'Teknik dan Informatika', 'Informatika', 'student@umn.ac.id'),
  ('7083ee5b-392b-5fca-9fc1-165c5e207cad', NULL, 'Michael Tan', '00000081234', 'Mahasiswa S2', 'student_s2', 'active', 'Teknik dan Informatika', 'Magister Teknologi Informasi', 'michael.tan@student.umn.ac.id');

INSERT INTO previous_ethics_clearances (id, user_id, applicant_name, clearance_number, research_title, issued_at, expiry_date) VALUES
  ('90ff7746-1a71-58da-b940-5b5e84fab850', '7e8badc6-2777-5e2a-9c06-8a122d9a7f5b', 'Dr. Budi Santoso', '001/KE-RIS/LPPM/01/2026', 'Studi Interaksi Pengguna pada Sistem Pembelajaran Digital', '2026-01-20', '2026-07-20'),
  ('2ddbe4ef-eaa1-5460-8eae-2d868a4e8248', NULL, 'Ayu Larasati', '014/KE-RIS/LPPM/03/2026', 'Analisis Pengalaman Mahasiswa dalam Pembelajaran Hybrid', '2026-03-12', '2026-09-12');

INSERT INTO schemes (id, name, description, start_date, end_date, registration_start_at, registration_end_at, year, maximum_budget, status, filters, created_by, created_at, updated_at) VALUES
  ('686d5460-a99c-5fad-bc4e-e85490147fef', 'Penelitian Dosen Pemula 2026', 'Pendanaan penelitian internal bagi dosen yang sedang membangun rekam jejak penelitian.', '2026-07-01', '2027-06-30', '2026-01-01T08:00', '2026-12-31T23:59', 2026, 25000000, 'open', '{}'::jsonb, 'a578e542-9765-56f2-9e76-11ea5ba7fa89', '2026-06-01T00:00:00.000Z', '2026-06-01T00:00:00.000Z'),
  ('45b260da-6f63-535a-ba91-1f3eb8a9b799', 'Hibah Penelitian Kompetitif Internal', 'Skema penelitian kompetitif untuk menghasilkan publikasi dan inovasi unggulan.', '2026-08-01', '2027-07-31', '2026-02-01T08:00', '2026-11-30T23:59', 2026, 75000000, 'open', '{}'::jsonb, 'a578e542-9765-56f2-9e76-11ea5ba7fa89', '2026-06-01T00:00:00.000Z', '2026-06-01T00:00:00.000Z'),
  ('02f96d91-8106-5055-bfb8-f3d0ea2df13a', 'Penelitian Kerjasama Industri', 'Penelitian kolaboratif bersama mitra industri strategis.', '2026-09-01', '2027-08-31', '2026-03-01T08:00', '2026-10-31T23:59', 2026, 150000000, 'open', '{}'::jsonb, 'a578e542-9765-56f2-9e76-11ea5ba7fa89', '2026-06-01T00:00:00.000Z', '2026-06-01T00:00:00.000Z'),
  ('52c1396b-a4a4-5e79-a1b5-e26e9f0604e8', 'Skema Demo Luaran Fleksibel 2026', 'Skema terbuka untuk mencoba pemilihan beberapa luaran wajib dan luaran tambahan pada proposal.', '2026-09-01', '2027-08-31', '2026-07-01T08:00', '2026-12-31T23:59', 2026, 50000000, 'open', '{}'::jsonb, 'a578e542-9765-56f2-9e76-11ea5ba7fa89', '2026-06-01T00:00:00.000Z', '2026-06-01T00:00:00.000Z'),
  ('0e7dc561-ede5-53f0-855c-95d910496459', 'Hibah Transformasi Pembelajaran Digital 2026', 'Pendanaan riset terapan untuk meningkatkan kualitas pembelajaran melalui teknologi digital yang terukur.', '2026-10-01', '2027-09-30', '2026-07-01T08:00', '2026-12-31T23:59', 2026, 65000000, 'open', '{}'::jsonb, 'a578e542-9765-56f2-9e76-11ea5ba7fa89', '2026-06-01T00:00:00.000Z', '2026-06-01T00:00:00.000Z'),
  ('e1ed411a-e3b2-533b-9450-fae4da602231', 'Hibah Inovasi Pembelajaran Berkelanjutan 2026', 'Pendanaan penelitian kolaboratif untuk menghasilkan inovasi pembelajaran yang terukur, inklusif, dan dapat diterapkan secara berkelanjutan.', '2026-11-01', '2027-10-31', '2026-08-01T08:00', '2026-12-31T23:59', 2026, 80000000, 'open', '{}'::jsonb, 'a578e542-9765-56f2-9e76-11ea5ba7fa89', '2026-06-01T00:00:00.000Z', '2026-06-01T00:00:00.000Z'),
  ('1cf9878b-505e-5a65-b1b1-60b6be16542c', 'Hibah Strategis Bisnis Berkelanjutan 2026', 'Skema kolaboratif bagi peneliti bidang bisnis untuk menghasilkan model keberlanjutan dan rekomendasi industri.', '2026-11-01', '2027-10-31', '2026-07-01T08:00', '2026-12-31T23:59', 2026, 90000000, 'open', '{}'::jsonb, 'a578e542-9765-56f2-9e76-11ea5ba7fa89', '2026-06-01T00:00:00.000Z', '2026-06-01T00:00:00.000Z');

INSERT INTO scheme_eligible_users (scheme_id, user_id) VALUES
  ('686d5460-a99c-5fad-bc4e-e85490147fef', '7e8badc6-2777-5e2a-9c06-8a122d9a7f5b'),
  ('686d5460-a99c-5fad-bc4e-e85490147fef', '58be059f-f33c-58f2-ad60-561f8e5ad55c'),
  ('686d5460-a99c-5fad-bc4e-e85490147fef', '08483b04-e38e-5602-b3de-2cd73d02fd40'),
  ('686d5460-a99c-5fad-bc4e-e85490147fef', '547f62ba-dcce-55bc-b8ec-e27958656529'),
  ('686d5460-a99c-5fad-bc4e-e85490147fef', '9263f343-101a-5c74-8740-ad6e2958cd84'),
  ('45b260da-6f63-535a-ba91-1f3eb8a9b799', '7e8badc6-2777-5e2a-9c06-8a122d9a7f5b'),
  ('45b260da-6f63-535a-ba91-1f3eb8a9b799', '58be059f-f33c-58f2-ad60-561f8e5ad55c'),
  ('02f96d91-8106-5055-bfb8-f3d0ea2df13a', '7e8badc6-2777-5e2a-9c06-8a122d9a7f5b'),
  ('02f96d91-8106-5055-bfb8-f3d0ea2df13a', '547f62ba-dcce-55bc-b8ec-e27958656529'),
  ('52c1396b-a4a4-5e79-a1b5-e26e9f0604e8', '7e8badc6-2777-5e2a-9c06-8a122d9a7f5b'),
  ('52c1396b-a4a4-5e79-a1b5-e26e9f0604e8', '58be059f-f33c-58f2-ad60-561f8e5ad55c'),
  ('52c1396b-a4a4-5e79-a1b5-e26e9f0604e8', '08483b04-e38e-5602-b3de-2cd73d02fd40'),
  ('52c1396b-a4a4-5e79-a1b5-e26e9f0604e8', '547f62ba-dcce-55bc-b8ec-e27958656529'),
  ('52c1396b-a4a4-5e79-a1b5-e26e9f0604e8', '9263f343-101a-5c74-8740-ad6e2958cd84'),
  ('0e7dc561-ede5-53f0-855c-95d910496459', '7e8badc6-2777-5e2a-9c06-8a122d9a7f5b'),
  ('0e7dc561-ede5-53f0-855c-95d910496459', '08483b04-e38e-5602-b3de-2cd73d02fd40'),
  ('e1ed411a-e3b2-533b-9450-fae4da602231', '7e8badc6-2777-5e2a-9c06-8a122d9a7f5b'),
  ('e1ed411a-e3b2-533b-9450-fae4da602231', '58be059f-f33c-58f2-ad60-561f8e5ad55c'),
  ('e1ed411a-e3b2-533b-9450-fae4da602231', '08483b04-e38e-5602-b3de-2cd73d02fd40'),
  ('e1ed411a-e3b2-533b-9450-fae4da602231', '547f62ba-dcce-55bc-b8ec-e27958656529'),
  ('e1ed411a-e3b2-533b-9450-fae4da602231', '9263f343-101a-5c74-8740-ad6e2958cd84'),
  ('1cf9878b-505e-5a65-b1b1-60b6be16542c', '58be059f-f33c-58f2-ad60-561f8e5ad55c'),
  ('1cf9878b-505e-5a65-b1b1-60b6be16542c', '547f62ba-dcce-55bc-b8ec-e27958656529');

INSERT INTO scheme_output_options (id, scheme_id, name, category, configuration, position) VALUES
  ('92a88cee-e67e-53a0-b173-2ba7ce639c7b', '686d5460-a99c-5fad-bc4e-e85490147fef', 'Artikel Jurnal SINTA 1', 'jurnal', '{"id":"scheme-output-sinta_1","journalTargetLevel":"sinta","journalIndexTarget":"SINTA 1","publicationType":"nasional","targetQuartile":"","proceedingType":"","indexTarget":"","bookType":"","publisherTarget":"","isbnPlan":"","hkiType":"","targetRegistrationYear":"","productType":"","targetTkt":"","expectedOutputForm":"","otherOutputType":"","value":"sinta_1"}'::jsonb, 1),
  ('9f910cec-0aae-5972-be45-57a36f416be7', '686d5460-a99c-5fad-bc4e-e85490147fef', 'Artikel Jurnal SINTA 2', 'jurnal', '{"id":"scheme-output-sinta_2","journalTargetLevel":"sinta","journalIndexTarget":"SINTA 2","publicationType":"nasional","targetQuartile":"","proceedingType":"","indexTarget":"","bookType":"","publisherTarget":"","isbnPlan":"","hkiType":"","targetRegistrationYear":"","productType":"","targetTkt":"","expectedOutputForm":"","otherOutputType":"","value":"sinta_2"}'::jsonb, 2),
  ('7b64c0b6-707a-5a30-8969-492ecaf66c65', '686d5460-a99c-5fad-bc4e-e85490147fef', 'Artikel Jurnal SINTA 3', 'jurnal', '{"id":"scheme-output-sinta_3","journalTargetLevel":"sinta","journalIndexTarget":"SINTA 3","publicationType":"nasional","targetQuartile":"","proceedingType":"","indexTarget":"","bookType":"","publisherTarget":"","isbnPlan":"","hkiType":"","targetRegistrationYear":"","productType":"","targetTkt":"","expectedOutputForm":"","otherOutputType":"","value":"sinta_3"}'::jsonb, 3),
  ('dad67c54-ed94-51fa-b7c7-5709ffb675a2', '686d5460-a99c-5fad-bc4e-e85490147fef', 'Artikel Jurnal SINTA 4', 'jurnal', '{"id":"scheme-output-sinta_4","journalTargetLevel":"sinta","journalIndexTarget":"SINTA 4","publicationType":"nasional","targetQuartile":"","proceedingType":"","indexTarget":"","bookType":"","publisherTarget":"","isbnPlan":"","hkiType":"","targetRegistrationYear":"","productType":"","targetTkt":"","expectedOutputForm":"","otherOutputType":"","value":"sinta_4"}'::jsonb, 4),
  ('061b069e-9d97-535e-aee8-c2c888240d7a', '686d5460-a99c-5fad-bc4e-e85490147fef', 'Artikel Jurnal SINTA 5', 'jurnal', '{"id":"scheme-output-sinta_5","journalTargetLevel":"sinta","journalIndexTarget":"SINTA 5","publicationType":"nasional","targetQuartile":"","proceedingType":"","indexTarget":"","bookType":"","publisherTarget":"","isbnPlan":"","hkiType":"","targetRegistrationYear":"","productType":"","targetTkt":"","expectedOutputForm":"","otherOutputType":"","value":"sinta_5"}'::jsonb, 5),
  ('69b757a7-f274-5c7c-88c6-9d5d5c52b4e0', '686d5460-a99c-5fad-bc4e-e85490147fef', 'Artikel Jurnal SINTA 6', 'jurnal', '{"id":"scheme-output-sinta_6","journalTargetLevel":"sinta","journalIndexTarget":"SINTA 6","publicationType":"nasional","targetQuartile":"","proceedingType":"","indexTarget":"","bookType":"","publisherTarget":"","isbnPlan":"","hkiType":"","targetRegistrationYear":"","productType":"","targetTkt":"","expectedOutputForm":"","otherOutputType":"","value":"sinta_6"}'::jsonb, 6),
  ('49583c19-3ec2-5e59-9e5d-2e4728c3431d', '686d5460-a99c-5fad-bc4e-e85490147fef', 'Artikel Jurnal Scopus Q1', 'jurnal', '{"id":"scheme-output-scopus_q1","journalTargetLevel":"scopus","journalIndexTarget":"Scopus Q1","publicationType":"internasional","targetQuartile":"Q1","proceedingType":"","indexTarget":"","bookType":"","publisherTarget":"","isbnPlan":"","hkiType":"","targetRegistrationYear":"","productType":"","targetTkt":"","expectedOutputForm":"","otherOutputType":"","value":"scopus_q1"}'::jsonb, 7),
  ('50e9089d-4e20-59d7-a016-9681c616b86c', '686d5460-a99c-5fad-bc4e-e85490147fef', 'Artikel Jurnal Scopus Q2', 'jurnal', '{"id":"scheme-output-scopus_q2","journalTargetLevel":"scopus","journalIndexTarget":"Scopus Q2","publicationType":"internasional","targetQuartile":"Q2","proceedingType":"","indexTarget":"","bookType":"","publisherTarget":"","isbnPlan":"","hkiType":"","targetRegistrationYear":"","productType":"","targetTkt":"","expectedOutputForm":"","otherOutputType":"","value":"scopus_q2"}'::jsonb, 8),
  ('8252cea7-2692-5282-8287-6ae768f8fc93', '686d5460-a99c-5fad-bc4e-e85490147fef', 'Artikel Jurnal Scopus Q3', 'jurnal', '{"id":"scheme-output-scopus_q3","journalTargetLevel":"scopus","journalIndexTarget":"Scopus Q3","publicationType":"internasional","targetQuartile":"Q3","proceedingType":"","indexTarget":"","bookType":"","publisherTarget":"","isbnPlan":"","hkiType":"","targetRegistrationYear":"","productType":"","targetTkt":"","expectedOutputForm":"","otherOutputType":"","value":"scopus_q3"}'::jsonb, 9),
  ('13f4b55c-2f3a-5168-8bd9-9d50223cd35e', '686d5460-a99c-5fad-bc4e-e85490147fef', 'Artikel Jurnal Scopus Q4', 'jurnal', '{"id":"scheme-output-scopus_q4","journalTargetLevel":"scopus","journalIndexTarget":"Scopus Q4","publicationType":"internasional","targetQuartile":"Q4","proceedingType":"","indexTarget":"","bookType":"","publisherTarget":"","isbnPlan":"","hkiType":"","targetRegistrationYear":"","productType":"","targetTkt":"","expectedOutputForm":"","otherOutputType":"","value":"scopus_q4"}'::jsonb, 10),
  ('ea8aa994-8a8d-5340-a93d-d4ea1ddf6b36', '686d5460-a99c-5fad-bc4e-e85490147fef', 'Paten Sederhana (terdaftar)', 'hki', '{"id":"scheme-output-paten_sederhana_registered","journalTargetLevel":"","journalIndexTarget":"","publicationType":"","targetQuartile":"","proceedingType":"","indexTarget":"","bookType":"","publisherTarget":"","isbnPlan":"","hkiType":"paten_sederhana","targetRegistrationYear":"2026","productType":"","targetTkt":"","expectedOutputForm":"","otherOutputType":"","value":"paten_sederhana_registered"}'::jsonb, 11),
  ('e1c299d6-71c6-525d-bdb9-c459160b373c', '686d5460-a99c-5fad-bc4e-e85490147fef', 'Paten (terdaftar)', 'hki', '{"id":"scheme-output-paten_registered","journalTargetLevel":"","journalIndexTarget":"","publicationType":"","targetQuartile":"","proceedingType":"","indexTarget":"","bookType":"","publisherTarget":"","isbnPlan":"","hkiType":"paten","targetRegistrationYear":"2026","productType":"","targetTkt":"","expectedOutputForm":"","otherOutputType":"","value":"paten_registered"}'::jsonb, 12),
  ('77814eea-d350-54d2-83e2-7b7a906b5ba4', '45b260da-6f63-535a-ba91-1f3eb8a9b799', 'Artikel Jurnal SINTA 1', 'jurnal', '{"id":"scheme-output-sinta_1","journalTargetLevel":"sinta","journalIndexTarget":"SINTA 1","publicationType":"nasional","targetQuartile":"","proceedingType":"","indexTarget":"","bookType":"","publisherTarget":"","isbnPlan":"","hkiType":"","targetRegistrationYear":"","productType":"","targetTkt":"","expectedOutputForm":"","otherOutputType":"","value":"sinta_1"}'::jsonb, 1),
  ('66fe65c6-b288-5682-aded-2ee352ca0ddb', '45b260da-6f63-535a-ba91-1f3eb8a9b799', 'Artikel Jurnal SINTA 2', 'jurnal', '{"id":"scheme-output-sinta_2","journalTargetLevel":"sinta","journalIndexTarget":"SINTA 2","publicationType":"nasional","targetQuartile":"","proceedingType":"","indexTarget":"","bookType":"","publisherTarget":"","isbnPlan":"","hkiType":"","targetRegistrationYear":"","productType":"","targetTkt":"","expectedOutputForm":"","otherOutputType":"","value":"sinta_2"}'::jsonb, 2),
  ('731ee0b3-ba68-5e29-8d28-ebb47c4733a0', '45b260da-6f63-535a-ba91-1f3eb8a9b799', 'Artikel Jurnal SINTA 3', 'jurnal', '{"id":"scheme-output-sinta_3","journalTargetLevel":"sinta","journalIndexTarget":"SINTA 3","publicationType":"nasional","targetQuartile":"","proceedingType":"","indexTarget":"","bookType":"","publisherTarget":"","isbnPlan":"","hkiType":"","targetRegistrationYear":"","productType":"","targetTkt":"","expectedOutputForm":"","otherOutputType":"","value":"sinta_3"}'::jsonb, 3),
  ('927d6bbb-397d-5871-a9a1-788ebe048bd5', '45b260da-6f63-535a-ba91-1f3eb8a9b799', 'Artikel Jurnal SINTA 4', 'jurnal', '{"id":"scheme-output-sinta_4","journalTargetLevel":"sinta","journalIndexTarget":"SINTA 4","publicationType":"nasional","targetQuartile":"","proceedingType":"","indexTarget":"","bookType":"","publisherTarget":"","isbnPlan":"","hkiType":"","targetRegistrationYear":"","productType":"","targetTkt":"","expectedOutputForm":"","otherOutputType":"","value":"sinta_4"}'::jsonb, 4),
  ('a7c130ad-5dc5-56ed-a9a5-87dfaeb520de', '45b260da-6f63-535a-ba91-1f3eb8a9b799', 'Artikel Jurnal SINTA 5', 'jurnal', '{"id":"scheme-output-sinta_5","journalTargetLevel":"sinta","journalIndexTarget":"SINTA 5","publicationType":"nasional","targetQuartile":"","proceedingType":"","indexTarget":"","bookType":"","publisherTarget":"","isbnPlan":"","hkiType":"","targetRegistrationYear":"","productType":"","targetTkt":"","expectedOutputForm":"","otherOutputType":"","value":"sinta_5"}'::jsonb, 5),
  ('94d34197-b70f-523b-8b58-d5cd39750c60', '45b260da-6f63-535a-ba91-1f3eb8a9b799', 'Artikel Jurnal SINTA 6', 'jurnal', '{"id":"scheme-output-sinta_6","journalTargetLevel":"sinta","journalIndexTarget":"SINTA 6","publicationType":"nasional","targetQuartile":"","proceedingType":"","indexTarget":"","bookType":"","publisherTarget":"","isbnPlan":"","hkiType":"","targetRegistrationYear":"","productType":"","targetTkt":"","expectedOutputForm":"","otherOutputType":"","value":"sinta_6"}'::jsonb, 6),
  ('611b2f2a-7ad1-5222-a78f-5de478be42c1', '45b260da-6f63-535a-ba91-1f3eb8a9b799', 'Artikel Jurnal Scopus Q1', 'jurnal', '{"id":"scheme-output-scopus_q1","journalTargetLevel":"scopus","journalIndexTarget":"Scopus Q1","publicationType":"internasional","targetQuartile":"Q1","proceedingType":"","indexTarget":"","bookType":"","publisherTarget":"","isbnPlan":"","hkiType":"","targetRegistrationYear":"","productType":"","targetTkt":"","expectedOutputForm":"","otherOutputType":"","value":"scopus_q1"}'::jsonb, 7),
  ('220f40e8-e02e-5a01-8fa2-2feb7acb2fc3', '45b260da-6f63-535a-ba91-1f3eb8a9b799', 'Artikel Jurnal Scopus Q2', 'jurnal', '{"id":"scheme-output-scopus_q2","journalTargetLevel":"scopus","journalIndexTarget":"Scopus Q2","publicationType":"internasional","targetQuartile":"Q2","proceedingType":"","indexTarget":"","bookType":"","publisherTarget":"","isbnPlan":"","hkiType":"","targetRegistrationYear":"","productType":"","targetTkt":"","expectedOutputForm":"","otherOutputType":"","value":"scopus_q2"}'::jsonb, 8),
  ('f291b040-77de-5ea4-8127-3db0b3e2b0ec', '45b260da-6f63-535a-ba91-1f3eb8a9b799', 'Artikel Jurnal Scopus Q3', 'jurnal', '{"id":"scheme-output-scopus_q3","journalTargetLevel":"scopus","journalIndexTarget":"Scopus Q3","publicationType":"internasional","targetQuartile":"Q3","proceedingType":"","indexTarget":"","bookType":"","publisherTarget":"","isbnPlan":"","hkiType":"","targetRegistrationYear":"","productType":"","targetTkt":"","expectedOutputForm":"","otherOutputType":"","value":"scopus_q3"}'::jsonb, 9),
  ('e5af8254-fe75-525f-9bff-1c34323a6cca', '45b260da-6f63-535a-ba91-1f3eb8a9b799', 'Artikel Jurnal Scopus Q4', 'jurnal', '{"id":"scheme-output-scopus_q4","journalTargetLevel":"scopus","journalIndexTarget":"Scopus Q4","publicationType":"internasional","targetQuartile":"Q4","proceedingType":"","indexTarget":"","bookType":"","publisherTarget":"","isbnPlan":"","hkiType":"","targetRegistrationYear":"","productType":"","targetTkt":"","expectedOutputForm":"","otherOutputType":"","value":"scopus_q4"}'::jsonb, 10),
  ('a7344347-ac3e-51c8-a930-d33d5bec9c82', '45b260da-6f63-535a-ba91-1f3eb8a9b799', 'Paten Sederhana (terdaftar)', 'hki', '{"id":"scheme-output-paten_sederhana_registered","journalTargetLevel":"","journalIndexTarget":"","publicationType":"","targetQuartile":"","proceedingType":"","indexTarget":"","bookType":"","publisherTarget":"","isbnPlan":"","hkiType":"paten_sederhana","targetRegistrationYear":"2026","productType":"","targetTkt":"","expectedOutputForm":"","otherOutputType":"","value":"paten_sederhana_registered"}'::jsonb, 11),
  ('5d8beae5-628f-53b5-822d-2066d92caea1', '45b260da-6f63-535a-ba91-1f3eb8a9b799', 'Paten (terdaftar)', 'hki', '{"id":"scheme-output-paten_registered","journalTargetLevel":"","journalIndexTarget":"","publicationType":"","targetQuartile":"","proceedingType":"","indexTarget":"","bookType":"","publisherTarget":"","isbnPlan":"","hkiType":"paten","targetRegistrationYear":"2026","productType":"","targetTkt":"","expectedOutputForm":"","otherOutputType":"","value":"paten_registered"}'::jsonb, 12),
  ('fa826152-401c-5975-b52c-cc277c990da7', '02f96d91-8106-5055-bfb8-f3d0ea2df13a', 'Artikel Jurnal SINTA 1', 'jurnal', '{"id":"scheme-output-sinta_1","journalTargetLevel":"sinta","journalIndexTarget":"SINTA 1","publicationType":"nasional","targetQuartile":"","proceedingType":"","indexTarget":"","bookType":"","publisherTarget":"","isbnPlan":"","hkiType":"","targetRegistrationYear":"","productType":"","targetTkt":"","expectedOutputForm":"","otherOutputType":"","value":"sinta_1"}'::jsonb, 1),
  ('8fa1f58c-8bea-5f28-b70c-c5096925aa0c', '02f96d91-8106-5055-bfb8-f3d0ea2df13a', 'Artikel Jurnal SINTA 2', 'jurnal', '{"id":"scheme-output-sinta_2","journalTargetLevel":"sinta","journalIndexTarget":"SINTA 2","publicationType":"nasional","targetQuartile":"","proceedingType":"","indexTarget":"","bookType":"","publisherTarget":"","isbnPlan":"","hkiType":"","targetRegistrationYear":"","productType":"","targetTkt":"","expectedOutputForm":"","otherOutputType":"","value":"sinta_2"}'::jsonb, 2),
  ('c8f283fc-a4fc-5e27-acbd-444a352c5f72', '02f96d91-8106-5055-bfb8-f3d0ea2df13a', 'Artikel Jurnal SINTA 3', 'jurnal', '{"id":"scheme-output-sinta_3","journalTargetLevel":"sinta","journalIndexTarget":"SINTA 3","publicationType":"nasional","targetQuartile":"","proceedingType":"","indexTarget":"","bookType":"","publisherTarget":"","isbnPlan":"","hkiType":"","targetRegistrationYear":"","productType":"","targetTkt":"","expectedOutputForm":"","otherOutputType":"","value":"sinta_3"}'::jsonb, 3),
  ('ffd8a9cc-d741-55c0-9706-ac2ff091f33a', '02f96d91-8106-5055-bfb8-f3d0ea2df13a', 'Artikel Jurnal SINTA 4', 'jurnal', '{"id":"scheme-output-sinta_4","journalTargetLevel":"sinta","journalIndexTarget":"SINTA 4","publicationType":"nasional","targetQuartile":"","proceedingType":"","indexTarget":"","bookType":"","publisherTarget":"","isbnPlan":"","hkiType":"","targetRegistrationYear":"","productType":"","targetTkt":"","expectedOutputForm":"","otherOutputType":"","value":"sinta_4"}'::jsonb, 4),
  ('2d24b082-b7c1-5330-a85f-32abf0f76048', '02f96d91-8106-5055-bfb8-f3d0ea2df13a', 'Artikel Jurnal SINTA 5', 'jurnal', '{"id":"scheme-output-sinta_5","journalTargetLevel":"sinta","journalIndexTarget":"SINTA 5","publicationType":"nasional","targetQuartile":"","proceedingType":"","indexTarget":"","bookType":"","publisherTarget":"","isbnPlan":"","hkiType":"","targetRegistrationYear":"","productType":"","targetTkt":"","expectedOutputForm":"","otherOutputType":"","value":"sinta_5"}'::jsonb, 5),
  ('b1b2e783-f7b7-5208-a14e-ae13510d89d6', '02f96d91-8106-5055-bfb8-f3d0ea2df13a', 'Artikel Jurnal SINTA 6', 'jurnal', '{"id":"scheme-output-sinta_6","journalTargetLevel":"sinta","journalIndexTarget":"SINTA 6","publicationType":"nasional","targetQuartile":"","proceedingType":"","indexTarget":"","bookType":"","publisherTarget":"","isbnPlan":"","hkiType":"","targetRegistrationYear":"","productType":"","targetTkt":"","expectedOutputForm":"","otherOutputType":"","value":"sinta_6"}'::jsonb, 6),
  ('37465841-f532-57ab-a296-1d836210a707', '02f96d91-8106-5055-bfb8-f3d0ea2df13a', 'Artikel Jurnal Scopus Q1', 'jurnal', '{"id":"scheme-output-scopus_q1","journalTargetLevel":"scopus","journalIndexTarget":"Scopus Q1","publicationType":"internasional","targetQuartile":"Q1","proceedingType":"","indexTarget":"","bookType":"","publisherTarget":"","isbnPlan":"","hkiType":"","targetRegistrationYear":"","productType":"","targetTkt":"","expectedOutputForm":"","otherOutputType":"","value":"scopus_q1"}'::jsonb, 7),
  ('fa10549c-0ac9-59f4-8d04-e0941df3cb9d', '02f96d91-8106-5055-bfb8-f3d0ea2df13a', 'Artikel Jurnal Scopus Q2', 'jurnal', '{"id":"scheme-output-scopus_q2","journalTargetLevel":"scopus","journalIndexTarget":"Scopus Q2","publicationType":"internasional","targetQuartile":"Q2","proceedingType":"","indexTarget":"","bookType":"","publisherTarget":"","isbnPlan":"","hkiType":"","targetRegistrationYear":"","productType":"","targetTkt":"","expectedOutputForm":"","otherOutputType":"","value":"scopus_q2"}'::jsonb, 8),
  ('78f154a8-b0d4-5930-a23f-455cea5480cd', '02f96d91-8106-5055-bfb8-f3d0ea2df13a', 'Artikel Jurnal Scopus Q3', 'jurnal', '{"id":"scheme-output-scopus_q3","journalTargetLevel":"scopus","journalIndexTarget":"Scopus Q3","publicationType":"internasional","targetQuartile":"Q3","proceedingType":"","indexTarget":"","bookType":"","publisherTarget":"","isbnPlan":"","hkiType":"","targetRegistrationYear":"","productType":"","targetTkt":"","expectedOutputForm":"","otherOutputType":"","value":"scopus_q3"}'::jsonb, 9),
  ('875294ed-1318-58ab-b30c-7a95bc0d40a0', '02f96d91-8106-5055-bfb8-f3d0ea2df13a', 'Artikel Jurnal Scopus Q4', 'jurnal', '{"id":"scheme-output-scopus_q4","journalTargetLevel":"scopus","journalIndexTarget":"Scopus Q4","publicationType":"internasional","targetQuartile":"Q4","proceedingType":"","indexTarget":"","bookType":"","publisherTarget":"","isbnPlan":"","hkiType":"","targetRegistrationYear":"","productType":"","targetTkt":"","expectedOutputForm":"","otherOutputType":"","value":"scopus_q4"}'::jsonb, 10),
  ('aa4def47-77e5-5275-9bb1-e25ee51d53ac', '02f96d91-8106-5055-bfb8-f3d0ea2df13a', 'Paten Sederhana (terdaftar)', 'hki', '{"id":"scheme-output-paten_sederhana_registered","journalTargetLevel":"","journalIndexTarget":"","publicationType":"","targetQuartile":"","proceedingType":"","indexTarget":"","bookType":"","publisherTarget":"","isbnPlan":"","hkiType":"paten_sederhana","targetRegistrationYear":"2026","productType":"","targetTkt":"","expectedOutputForm":"","otherOutputType":"","value":"paten_sederhana_registered"}'::jsonb, 11),
  ('c3923ab5-dfa0-5242-b6e2-4c98575b1dd7', '02f96d91-8106-5055-bfb8-f3d0ea2df13a', 'Paten (terdaftar)', 'hki', '{"id":"scheme-output-paten_registered","journalTargetLevel":"","journalIndexTarget":"","publicationType":"","targetQuartile":"","proceedingType":"","indexTarget":"","bookType":"","publisherTarget":"","isbnPlan":"","hkiType":"paten","targetRegistrationYear":"2026","productType":"","targetTkt":"","expectedOutputForm":"","otherOutputType":"","value":"paten_registered"}'::jsonb, 12),
  ('2bc9ff08-e7bd-5023-a62c-9515f7d975cb', '52c1396b-a4a4-5e79-a1b5-e26e9f0604e8', 'Artikel Jurnal Scopus Q2', 'jurnal', '{"id":"demo-output-journal","journalTargetLevel":"scopus","journalIndexTarget":"Scopus Q2","publicationType":"internasional","targetQuartile":"Q2","proceedingType":"","indexTarget":"","bookType":"","publisherTarget":"","isbnPlan":"","hkiType":"","targetRegistrationYear":"","productType":"","targetTkt":"","expectedOutputForm":"","otherOutputType":""}'::jsonb, 1),
  ('c1ab7673-27b8-5376-82c4-82696285b735', '52c1396b-a4a4-5e79-a1b5-e26e9f0604e8', 'Prosiding Internasional Terindeks Scopus', 'prosiding', '{"id":"demo-output-proceeding","journalTargetLevel":"","journalIndexTarget":"","publicationType":"","targetQuartile":"","proceedingType":"internasional","indexTarget":"Scopus","bookType":"","publisherTarget":"","isbnPlan":"","hkiType":"","targetRegistrationYear":"","productType":"","targetTkt":"","expectedOutputForm":"","otherOutputType":""}'::jsonb, 2),
  ('4ce01f6f-c998-53a4-ac73-640130c57fe2', '52c1396b-a4a4-5e79-a1b5-e26e9f0604e8', 'Paten Sederhana (terdaftar)', 'hki', '{"id":"demo-output-hki","journalTargetLevel":"","journalIndexTarget":"","publicationType":"","targetQuartile":"","proceedingType":"","indexTarget":"","bookType":"","publisherTarget":"","isbnPlan":"","hkiType":"paten_sederhana","targetRegistrationYear":"2027","productType":"","targetTkt":"","expectedOutputForm":"","otherOutputType":""}'::jsonb, 3),
  ('3112aa61-b508-5565-8aea-debd642e5873', '0e7dc561-ede5-53f0-855c-95d910496459', 'Artikel Jurnal Scopus Q2', 'jurnal', '{"id":"demo-output-journal","journalTargetLevel":"scopus","journalIndexTarget":"Scopus Q2","publicationType":"internasional","targetQuartile":"Q2","proceedingType":"","indexTarget":"","bookType":"","publisherTarget":"","isbnPlan":"","hkiType":"","targetRegistrationYear":"","productType":"","targetTkt":"","expectedOutputForm":"","otherOutputType":""}'::jsonb, 1),
  ('ace77f2b-3c29-5319-86ac-28f68a7b6072', '0e7dc561-ede5-53f0-855c-95d910496459', 'Prosiding Internasional Terindeks Scopus', 'prosiding', '{"id":"demo-output-proceeding","journalTargetLevel":"","journalIndexTarget":"","publicationType":"","targetQuartile":"","proceedingType":"internasional","indexTarget":"Scopus","bookType":"","publisherTarget":"","isbnPlan":"","hkiType":"","targetRegistrationYear":"","productType":"","targetTkt":"","expectedOutputForm":"","otherOutputType":""}'::jsonb, 2),
  ('02cfad72-7fa2-5caf-a940-914e5dfe7d7b', '0e7dc561-ede5-53f0-855c-95d910496459', 'Paten Sederhana (terdaftar)', 'hki', '{"id":"demo-output-hki","journalTargetLevel":"","journalIndexTarget":"","publicationType":"","targetQuartile":"","proceedingType":"","indexTarget":"","bookType":"","publisherTarget":"","isbnPlan":"","hkiType":"paten_sederhana","targetRegistrationYear":"2027","productType":"","targetTkt":"","expectedOutputForm":"","otherOutputType":""}'::jsonb, 3),
  ('e03c74f2-c6b6-5e08-9e09-5c50b0a77857', 'e1ed411a-e3b2-533b-9450-fae4da602231', 'Artikel Jurnal Scopus Q2', 'jurnal', '{"id":"demo-output-journal","journalTargetLevel":"scopus","journalIndexTarget":"Scopus Q2","publicationType":"internasional","targetQuartile":"Q2","proceedingType":"","indexTarget":"","bookType":"","publisherTarget":"","isbnPlan":"","hkiType":"","targetRegistrationYear":"","productType":"","targetTkt":"","expectedOutputForm":"","otherOutputType":""}'::jsonb, 1),
  ('98d59bf7-0b2a-5a41-9df3-b9d7e55c69de', 'e1ed411a-e3b2-533b-9450-fae4da602231', 'Prosiding Internasional Terindeks Scopus', 'prosiding', '{"id":"demo-output-proceeding","journalTargetLevel":"","journalIndexTarget":"","publicationType":"","targetQuartile":"","proceedingType":"internasional","indexTarget":"Scopus","bookType":"","publisherTarget":"","isbnPlan":"","hkiType":"","targetRegistrationYear":"","productType":"","targetTkt":"","expectedOutputForm":"","otherOutputType":""}'::jsonb, 2),
  ('43cd7577-24e1-5ef4-af53-e238d2cbdf4a', 'e1ed411a-e3b2-533b-9450-fae4da602231', 'Paten Sederhana (terdaftar)', 'hki', '{"id":"demo-output-hki","journalTargetLevel":"","journalIndexTarget":"","publicationType":"","targetQuartile":"","proceedingType":"","indexTarget":"","bookType":"","publisherTarget":"","isbnPlan":"","hkiType":"paten_sederhana","targetRegistrationYear":"2027","productType":"","targetTkt":"","expectedOutputForm":"","otherOutputType":""}'::jsonb, 3),
  ('d78b37cc-fd3e-5306-8f0f-f070244f0c51', '1cf9878b-505e-5a65-b1b1-60b6be16542c', 'Artikel Jurnal Scopus Q2', 'jurnal', '{"id":"demo-output-journal","journalTargetLevel":"scopus","journalIndexTarget":"Scopus Q2","publicationType":"internasional","targetQuartile":"Q2","proceedingType":"","indexTarget":"","bookType":"","publisherTarget":"","isbnPlan":"","hkiType":"","targetRegistrationYear":"","productType":"","targetTkt":"","expectedOutputForm":"","otherOutputType":""}'::jsonb, 1),
  ('0605efc8-a927-586d-a4a6-ceee8166abd5', '1cf9878b-505e-5a65-b1b1-60b6be16542c', 'Prosiding Internasional Terindeks Scopus', 'prosiding', '{"id":"demo-output-proceeding","journalTargetLevel":"","journalIndexTarget":"","publicationType":"","targetQuartile":"","proceedingType":"internasional","indexTarget":"Scopus","bookType":"","publisherTarget":"","isbnPlan":"","hkiType":"","targetRegistrationYear":"","productType":"","targetTkt":"","expectedOutputForm":"","otherOutputType":""}'::jsonb, 2),
  ('8d1e3e00-1bf3-535e-8be0-2ec06da8b425', '1cf9878b-505e-5a65-b1b1-60b6be16542c', 'Paten Sederhana (terdaftar)', 'hki', '{"id":"demo-output-hki","journalTargetLevel":"","journalIndexTarget":"","publicationType":"","targetQuartile":"","proceedingType":"","indexTarget":"","bookType":"","publisherTarget":"","isbnPlan":"","hkiType":"paten_sederhana","targetRegistrationYear":"2027","productType":"","targetTkt":"","expectedOutputForm":"","otherOutputType":""}'::jsonb, 3);

INSERT INTO scheme_attachment_requirements (id, scheme_id, category, name, accepted_extensions, template_accepted_extensions, is_required, is_custom, template_file_id, position) VALUES
  ('f77e031a-97e5-5d93-ac83-19f4e9068db6', '686d5460-a99c-5fad-bc4e-e85490147fef', 'proposal', 'Proposal Penelitian', '.pdf', '.pdf,.doc,.docx', TRUE, FALSE, NULL, 1),
  ('51e57683-ea3d-547f-b6d1-abfd4a04d4ba', '686d5460-a99c-5fad-bc4e-e85490147fef', 'rab', 'Rencana Anggaran Biaya (RAB)', '.xls,.xlsx', '.xls,.xlsx', TRUE, FALSE, NULL, 2),
  ('e99813c2-ee5b-54b5-a266-c19c082271e8', '45b260da-6f63-535a-ba91-1f3eb8a9b799', 'proposal', 'Proposal Penelitian', '.pdf', '.pdf,.doc,.docx', TRUE, FALSE, NULL, 1),
  ('032df386-0d40-5ed4-9eaf-d9dcb1e2fc86', '45b260da-6f63-535a-ba91-1f3eb8a9b799', 'rab', 'Rencana Anggaran Biaya (RAB)', '.xls,.xlsx', '.xls,.xlsx', TRUE, FALSE, NULL, 2),
  ('7edc1008-a09b-52d3-b2a7-532d42e13d9a', '02f96d91-8106-5055-bfb8-f3d0ea2df13a', 'proposal', 'Proposal Penelitian', '.pdf', '.pdf,.doc,.docx', TRUE, FALSE, NULL, 1),
  ('08a6cfd8-57f6-5de5-a7c0-a322f91ef029', '02f96d91-8106-5055-bfb8-f3d0ea2df13a', 'rab', 'Rencana Anggaran Biaya (RAB)', '.xls,.xlsx', '.xls,.xlsx', TRUE, FALSE, NULL, 2),
  ('ab35fa1e-fe9a-5c2c-977f-2cc02bba8019', '52c1396b-a4a4-5e79-a1b5-e26e9f0604e8', 'proposal', 'Proposal Penelitian', '.pdf', '.pdf,.doc,.docx', TRUE, FALSE, NULL, 1),
  ('31419698-7d88-5003-b59c-e0171f7ceddc', '52c1396b-a4a4-5e79-a1b5-e26e9f0604e8', 'rab', 'Rencana Anggaran Biaya (RAB)', '.xls,.xlsx', '.xls,.xlsx', TRUE, FALSE, NULL, 2),
  ('5a45e871-f351-503a-b1cd-e9135bc1c27f', '0e7dc561-ede5-53f0-855c-95d910496459', 'proposal', 'Proposal Penelitian', '.pdf', '.pdf,.doc,.docx', TRUE, FALSE, '5de1dad1-b07f-56de-9d13-f86f277d34af', 1),
  ('a02dfe43-668d-5f7a-9025-9eb58d052b11', '0e7dc561-ede5-53f0-855c-95d910496459', 'rab', 'Rencana Anggaran Biaya (RAB)', '.xls,.xlsx', '.xls,.xlsx', TRUE, FALSE, '6ec0511d-b3f0-5c83-be66-7dec58c05ff6', 2),
  ('078a7c36-41bb-5ae7-9544-2155fc19f25a', '0e7dc561-ede5-53f0-855c-95d910496459', 'scheme_attachment_lead_statement', 'Surat Pernyataan Ketua Peneliti', '.pdf', '.pdf,.doc,.docx', TRUE, TRUE, 'd84b8f31-d224-5870-9531-daa91faa7e05', 3),
  ('c313ecbb-b805-541d-955c-e144103c5d48', '0e7dc561-ede5-53f0-855c-95d910496459', 'scheme_attachment_partner_statement', 'Surat Kesediaan Mitra', '.pdf', '.pdf,.doc,.docx', TRUE, TRUE, '0e34a6b0-0272-55dd-85f3-d22167a51259', 4),
  ('6513a24c-e410-5e31-88d0-6cbdf3082a10', '0e7dc561-ede5-53f0-855c-95d910496459', 'scheme_attachment_integrity_pact', 'Pakta Integritas Tim Peneliti', '.pdf', '.pdf,.doc,.docx', TRUE, TRUE, 'c68c9875-5401-53c4-8d36-3759069e8ecc', 5),
  ('69900622-04a2-5adb-a3c1-9742b37eecc1', '0e7dc561-ede5-53f0-855c-95d910496459', 'scheme_attachment_team_cv', 'Biodata Tim Peneliti', '.pdf', '.pdf,.doc,.docx', TRUE, TRUE, '36de7a31-fd54-5c27-a5b2-27207a59e6c5', 6),
  ('48dedeb6-c0d3-5cd7-83fb-fb8f3eb30d7c', 'e1ed411a-e3b2-533b-9450-fae4da602231', 'proposal', 'Proposal Penelitian', '.pdf', '.pdf,.doc,.docx', TRUE, FALSE, 'ad8365c2-2afe-586a-a344-98c7abf3b08b', 1),
  ('90431ced-2c31-5761-8b26-6ddc3c9ec123', 'e1ed411a-e3b2-533b-9450-fae4da602231', 'rab', 'Rencana Anggaran Biaya (RAB)', '.xls,.xlsx', '.xls,.xlsx', TRUE, FALSE, 'af584181-b9a3-5d66-b733-4fc1921f48b1', 2),
  ('7a2ce017-b1ec-55a5-9d68-d6350e2fea2b', 'e1ed411a-e3b2-533b-9450-fae4da602231', 'scheme_attachment_lead_statement', 'Surat Pernyataan Ketua Peneliti', '.pdf', '.pdf,.doc,.docx', TRUE, TRUE, '9e8650e6-b8dd-5848-b71d-2209f9ceddf1', 3),
  ('f8dd0ff5-6446-5594-8a28-e65cabf14f08', 'e1ed411a-e3b2-533b-9450-fae4da602231', 'scheme_attachment_partner_statement', 'Surat Kesediaan Mitra', '.pdf', '.pdf,.doc,.docx', TRUE, TRUE, 'f2697a8c-3bb1-5f58-82d2-eae85ee43bfa', 4),
  ('33266776-d06e-5605-9cc1-57237f3ac06b', 'e1ed411a-e3b2-533b-9450-fae4da602231', 'scheme_attachment_integrity_pact', 'Pakta Integritas Tim Peneliti', '.pdf', '.pdf,.doc,.docx', TRUE, TRUE, 'a3525d4a-a8bc-5eb4-89a8-c1c0fdf26a0e', 5),
  ('ef73f236-468a-5bb4-a2ca-ce2cd5190c1c', 'e1ed411a-e3b2-533b-9450-fae4da602231', 'scheme_attachment_team_cv', 'Biodata Tim Peneliti', '.pdf', '.pdf,.doc,.docx', TRUE, TRUE, 'd857cc74-546a-5a38-9af3-192d98de11b9', 6),
  ('a606a005-7182-5bc8-8bfa-cd6069d8340c', '1cf9878b-505e-5a65-b1b1-60b6be16542c', 'proposal', 'Proposal Penelitian', '.pdf', '.pdf,.doc,.docx', TRUE, FALSE, NULL, 1),
  ('947af504-c283-5136-870f-e694688c22e6', '1cf9878b-505e-5a65-b1b1-60b6be16542c', 'rab', 'Rencana Anggaran Biaya (RAB)', '.xls,.xlsx', '.xls,.xlsx', TRUE, FALSE, NULL, 2);

INSERT INTO scheme_reporting_periods (id, scheme_id, report_type, label, open_at, due_at, position, created_by) VALUES
  ('f458b84c-b9ce-5287-8e5b-f95f1898edfe', '686d5460-a99c-5fad-bc4e-e85490147fef', 'interim', 'Laporan Sementara Periode 1', '2026-07-01T00:00', '2026-11-05T17:59', 1, 'a578e542-9765-56f2-9e76-11ea5ba7fa89'),
  ('b7430f36-4b73-547a-8e27-85cb3def97cd', '686d5460-a99c-5fad-bc4e-e85490147fef', 'interim', 'Laporan Sementara Periode 2', '2026-11-06T17:59', '2027-03-13T11:59', 2, 'a578e542-9765-56f2-9e76-11ea5ba7fa89'),
  ('79fa375f-fecd-52ed-94a7-439499186867', '686d5460-a99c-5fad-bc4e-e85490147fef', 'final', 'Laporan Akhir', '2027-05-31T23:59', '2027-06-30T23:59', 3, 'a578e542-9765-56f2-9e76-11ea5ba7fa89'),
  ('b2cf90fd-1e68-5f58-97fc-da2831be54a7', '686d5460-a99c-5fad-bc4e-e85490147fef', 'output', 'Laporan Luaran', '2027-05-31T23:59', '2027-09-28T23:59', 4, 'a578e542-9765-56f2-9e76-11ea5ba7fa89'),
  ('069bcec8-1c24-5778-8e46-4751fd7c4d02', '45b260da-6f63-535a-ba91-1f3eb8a9b799', 'interim', 'Laporan Sementara Periode 1', '2026-08-01T00:00', '2026-12-06T17:59', 1, 'a578e542-9765-56f2-9e76-11ea5ba7fa89'),
  ('0c180059-6b82-5202-a831-067b0113b4cd', '45b260da-6f63-535a-ba91-1f3eb8a9b799', 'interim', 'Laporan Sementara Periode 2', '2026-12-07T17:59', '2027-04-13T11:59', 2, 'a578e542-9765-56f2-9e76-11ea5ba7fa89'),
  ('4191aa90-ea82-5f01-bb60-afa1e68408d6', '45b260da-6f63-535a-ba91-1f3eb8a9b799', 'final', 'Laporan Akhir', '2027-07-01T23:59', '2027-07-31T23:59', 3, 'a578e542-9765-56f2-9e76-11ea5ba7fa89'),
  ('1d9fc45f-af58-5408-ad98-fb71c134904f', '45b260da-6f63-535a-ba91-1f3eb8a9b799', 'output', 'Laporan Luaran', '2027-07-01T23:59', '2027-10-29T23:59', 4, 'a578e542-9765-56f2-9e76-11ea5ba7fa89'),
  ('296a0669-3ec8-5a3f-bbd0-951a53a90362', '02f96d91-8106-5055-bfb8-f3d0ea2df13a', 'interim', 'Laporan Sementara Periode 1', '2026-09-01T00:00', '2027-01-06T17:59', 1, 'a578e542-9765-56f2-9e76-11ea5ba7fa89'),
  ('fb8414be-5fdd-5d5f-8923-bfdbfdca5471', '02f96d91-8106-5055-bfb8-f3d0ea2df13a', 'interim', 'Laporan Sementara Periode 2', '2027-01-07T17:59', '2027-05-14T11:59', 2, 'a578e542-9765-56f2-9e76-11ea5ba7fa89'),
  ('ecff1b79-040c-5b74-8c33-49ebe2ece8ed', '02f96d91-8106-5055-bfb8-f3d0ea2df13a', 'final', 'Laporan Akhir', '2027-08-01T23:59', '2027-08-31T23:59', 3, 'a578e542-9765-56f2-9e76-11ea5ba7fa89'),
  ('e00bff62-bafa-52bf-99c7-4b0028014c94', '02f96d91-8106-5055-bfb8-f3d0ea2df13a', 'output', 'Laporan Luaran', '2027-08-01T23:59', '2027-11-29T23:59', 4, 'a578e542-9765-56f2-9e76-11ea5ba7fa89'),
  ('2495b9a7-8f3f-5e47-ba9a-ad12307ff0b6', '52c1396b-a4a4-5e79-a1b5-e26e9f0604e8', 'interim', 'Laporan Sementara Periode 1', '2026-09-01T00:00', '2027-01-06T17:59', 1, 'a578e542-9765-56f2-9e76-11ea5ba7fa89'),
  ('31320ed2-ec39-5580-bb18-3c11c6c19fb6', '52c1396b-a4a4-5e79-a1b5-e26e9f0604e8', 'interim', 'Laporan Sementara Periode 2', '2027-01-07T17:59', '2027-05-14T11:59', 2, 'a578e542-9765-56f2-9e76-11ea5ba7fa89'),
  ('4df26c31-9b30-5a30-b5a4-401bdfd1045a', '52c1396b-a4a4-5e79-a1b5-e26e9f0604e8', 'final', 'Laporan Akhir', '2027-08-01T23:59', '2027-08-31T23:59', 3, 'a578e542-9765-56f2-9e76-11ea5ba7fa89'),
  ('167f54a8-e550-55ff-9c7e-9b27d9d6bc3f', '52c1396b-a4a4-5e79-a1b5-e26e9f0604e8', 'output', 'Laporan Luaran', '2027-08-01T23:59', '2027-11-29T23:59', 4, 'a578e542-9765-56f2-9e76-11ea5ba7fa89'),
  ('37096f61-6eb2-5b42-a20b-a431a9eb40d1', '0e7dc561-ede5-53f0-855c-95d910496459', 'interim', 'Laporan Sementara Periode 1', '2026-10-01T00:00', '2027-02-05T17:59', 1, 'a578e542-9765-56f2-9e76-11ea5ba7fa89'),
  ('efb9ecd6-f0b0-5f4f-a6a6-68adb6fb71b6', '0e7dc561-ede5-53f0-855c-95d910496459', 'interim', 'Laporan Sementara Periode 2', '2027-02-06T17:59', '2027-06-13T11:59', 2, 'a578e542-9765-56f2-9e76-11ea5ba7fa89'),
  ('22cc3670-1dd6-51ad-a7da-05ff07d925ae', '0e7dc561-ede5-53f0-855c-95d910496459', 'final', 'Laporan Akhir', '2027-08-31T23:59', '2027-09-30T23:59', 3, 'a578e542-9765-56f2-9e76-11ea5ba7fa89'),
  ('8e311580-606b-54fd-9338-396e626533f0', '0e7dc561-ede5-53f0-855c-95d910496459', 'output', 'Laporan Luaran', '2027-08-31T23:59', '2027-12-29T23:59', 4, 'a578e542-9765-56f2-9e76-11ea5ba7fa89'),
  ('05d5e7de-1153-5b1f-a766-00d228948074', 'e1ed411a-e3b2-533b-9450-fae4da602231', 'interim', 'Laporan Sementara Periode 1', '2026-11-01T00:00', '2027-03-08T17:59', 1, 'a578e542-9765-56f2-9e76-11ea5ba7fa89'),
  ('04898770-e1b7-5c04-bb37-b54956f989cf', 'e1ed411a-e3b2-533b-9450-fae4da602231', 'interim', 'Laporan Sementara Periode 2', '2027-03-09T17:59', '2027-07-14T11:59', 2, 'a578e542-9765-56f2-9e76-11ea5ba7fa89'),
  ('8d555a2f-e9bf-5a9d-b523-4e2e46a65ad1', 'e1ed411a-e3b2-533b-9450-fae4da602231', 'final', 'Laporan Akhir', '2027-10-01T23:59', '2027-10-31T23:59', 3, 'a578e542-9765-56f2-9e76-11ea5ba7fa89'),
  ('ee900236-17da-5b1d-9adb-45d0e330fcc0', 'e1ed411a-e3b2-533b-9450-fae4da602231', 'output', 'Laporan Luaran', '2027-10-01T23:59', '2028-01-29T23:59', 4, 'a578e542-9765-56f2-9e76-11ea5ba7fa89'),
  ('fa6b116a-52be-5af9-94dd-67e8df99b0c6', '1cf9878b-505e-5a65-b1b1-60b6be16542c', 'interim', 'Laporan Sementara Periode 1', '2026-11-01T00:00', '2027-03-08T17:59', 1, 'a578e542-9765-56f2-9e76-11ea5ba7fa89'),
  ('0f723a87-6563-561f-a033-e8c5d591acf1', '1cf9878b-505e-5a65-b1b1-60b6be16542c', 'interim', 'Laporan Sementara Periode 2', '2027-03-09T17:59', '2027-07-14T11:59', 2, 'a578e542-9765-56f2-9e76-11ea5ba7fa89'),
  ('83152273-c9f6-5627-9b92-f139a42f4264', '1cf9878b-505e-5a65-b1b1-60b6be16542c', 'final', 'Laporan Akhir', '2027-10-01T23:59', '2027-10-31T23:59', 3, 'a578e542-9765-56f2-9e76-11ea5ba7fa89'),
  ('885be221-3cc3-55a6-be34-c55b994d6da9', '1cf9878b-505e-5a65-b1b1-60b6be16542c', 'output', 'Laporan Luaran', '2027-10-01T23:59', '2028-01-29T23:59', 4, 'a578e542-9765-56f2-9e76-11ea5ba7fa89');

INSERT INTO research_drafts (id, user_id, scheme_id, status, current_step, requested_budget, budget_sections, created_by, submitted_at, last_saved_at, decided_at, created_at, updated_at) VALUES
  ('0d2ba50b-ddf0-52b0-9af6-f18ab2f60835', '7e8badc6-2777-5e2a-9c06-8a122d9a7f5b', '686d5460-a99c-5fad-bc4e-e85490147fef', 'submitted', 1, NULL, '[]'::jsonb, '7e8badc6-2777-5e2a-9c06-8a122d9a7f5b', '2026-05-06T03:15:00.000Z', NULL, NULL, '2026-05-04T08:30:00.000Z', '2026-05-04T08:30:00.000Z'),
  ('b34f8ab9-c62f-5262-9805-c69cbd9cec05', '7e8badc6-2777-5e2a-9c06-8a122d9a7f5b', '45b260da-6f63-535a-ba91-1f3eb8a9b799', 'under_review', 1, NULL, '[]'::jsonb, '7e8badc6-2777-5e2a-9c06-8a122d9a7f5b', '2026-05-06T03:15:00.000Z', NULL, NULL, '2026-05-04T08:30:00.000Z', '2026-05-04T08:30:00.000Z'),
  ('a2c66167-6db8-5640-ab7a-457e3ae6a69f', '7e8badc6-2777-5e2a-9c06-8a122d9a7f5b', '02f96d91-8106-5055-bfb8-f3d0ea2df13a', 'reviewed', 1, NULL, '[]'::jsonb, '7e8badc6-2777-5e2a-9c06-8a122d9a7f5b', '2026-05-06T03:15:00.000Z', NULL, NULL, '2026-05-04T08:30:00.000Z', '2026-05-04T08:30:00.000Z'),
  ('b954b1cb-cfd5-5b74-9e90-20b865514f22', '7e8badc6-2777-5e2a-9c06-8a122d9a7f5b', '686d5460-a99c-5fad-bc4e-e85490147fef', 'funded', 1, NULL, '[]'::jsonb, '7e8badc6-2777-5e2a-9c06-8a122d9a7f5b', '2026-05-06T03:15:00.000Z', NULL, '2026-05-12T04:00:00.000Z', '2026-05-04T08:30:00.000Z', '2026-05-04T08:30:00.000Z'),
  ('60d7ffc0-da80-580c-b4d2-2e17b94e4698', '7e8badc6-2777-5e2a-9c06-8a122d9a7f5b', '0e7dc561-ede5-53f0-855c-95d910496459', 'draft', 3, NULL, '[]'::jsonb, '7e8badc6-2777-5e2a-9c06-8a122d9a7f5b', NULL, '2026-07-22T09:30:00.000Z', NULL, '2026-05-04T08:30:00.000Z', '2026-07-22T09:30:00.000Z');

INSERT INTO draft_projects (id, draft_id, title, target_tkt, rip_relation, research_center_relation, research_center_other, integrated_to_teaching, course_name, academic_year, metadata) VALUES
  ('969655e3-553c-52bc-b794-c2fcf75d381b', '0d2ba50b-ddf0-52b0-9af6-f18ab2f60835', 'Pengembangan Sistem Analitik Penelitian Berbasis Kecerdasan Buatan', 5, 'ict_based', 'ict_based', NULL, TRUE, 'machine_learning', '2025/2026', '{"mandatoryOutputPlan":"scopus_q2","additionalOutputPlan":"prototype","additionalOutputPlans":["prototype"]}'::jsonb),
  ('4ddf34b5-5804-5cc7-ab36-5204bf2f20e6', 'b34f8ab9-c62f-5262-9805-c69cbd9cec05', 'Model Prediksi Keberhasilan Studi Mahasiswa Menggunakan Machine Learning', 5, 'ict_based', 'ict_based', NULL, TRUE, 'machine_learning', '2025/2026', '{"mandatoryOutputPlan":"scopus_q2","additionalOutputPlan":"prototype","additionalOutputPlans":["prototype"]}'::jsonb),
  ('94ac7741-4477-5eb6-8b74-3f333bdb303e', 'a2c66167-6db8-5640-ab7a-457e3ae6a69f', 'Platform Kolaborasi Riset Universitas dan Industri Kreatif', 5, 'ict_based', 'ict_based', NULL, TRUE, 'machine_learning', '2025/2026', '{"mandatoryOutputPlan":"scopus_q2","additionalOutputPlan":"prototype","additionalOutputPlans":["prototype"]}'::jsonb),
  ('ac4e08ab-d19d-5599-b290-35048b1f64be', 'b954b1cb-cfd5-5b74-9e90-20b865514f22', 'Pengembangan Repositori Riset Terintegrasi', 5, 'ict_based', 'ict_based', NULL, TRUE, 'machine_learning', '2025/2026', '{"mandatoryOutputPlan":"scopus_q2","additionalOutputPlan":"prototype","additionalOutputPlans":["prototype"]}'::jsonb),
  ('9ae87928-11c9-54db-b804-d6e3eed5484e', '60d7ffc0-da80-580c-b4d2-2e17b94e4698', 'Adaptive Learning untuk Peningkatan Retensi Mahasiswa', 5, 'ict_based', 'ict_based', NULL, TRUE, 'machine_learning', '2025/2026', '{"mandatoryOutputPlan":"scopus_q2","additionalOutputPlan":"prototype","additionalOutputPlans":["prototype"]}'::jsonb);

INSERT INTO draft_project_sdgs (project_id, sdg_id) VALUES
  ('969655e3-553c-52bc-b794-c2fcf75d381b', 4),
  ('969655e3-553c-52bc-b794-c2fcf75d381b', 9),
  ('4ddf34b5-5804-5cc7-ab36-5204bf2f20e6', 4),
  ('4ddf34b5-5804-5cc7-ab36-5204bf2f20e6', 9),
  ('94ac7741-4477-5eb6-8b74-3f333bdb303e', 4),
  ('94ac7741-4477-5eb6-8b74-3f333bdb303e', 9),
  ('ac4e08ab-d19d-5599-b290-35048b1f64be', 4),
  ('ac4e08ab-d19d-5599-b290-35048b1f64be', 9),
  ('9ae87928-11c9-54db-b804-d6e3eed5484e', 4),
  ('9ae87928-11c9-54db-b804-d6e3eed5484e', 9);

INSERT INTO draft_members (id, draft_id, role, member_type, profile_id, user_id, name, nidn, nim, study_program, faculty, orcid, email, position) VALUES
  ('e02900f3-7002-5c50-9651-b3ff4fdc627f', '0d2ba50b-ddf0-52b0-9af6-f18ab2f60835', 'ketua', 'internal_lecturer', '1a826f2d-8c7e-52ca-abfc-8ae75f1cb6c4', '7e8badc6-2777-5e2a-9c06-8a122d9a7f5b', 'Dr. Budi Santoso', '0312048501', NULL, 'Sistem Informasi', 'Teknik dan Informatika', '0000000218250097', NULL, 1),
  ('914e5657-e5e3-5e8b-97f0-02a2808ad218', '0d2ba50b-ddf0-52b0-9af6-f18ab2f60835', 'member', 'internal_lecturer', '9d5ccc3c-ac0a-51df-b375-5fe8699dcaeb', '58be059f-f33c-58f2-ad60-561f8e5ad55c', 'Dr. Andini Prameswari', '0308078602', NULL, 'Informatika', 'Teknik dan Informatika', '0000000319261188', NULL, 2),
  ('dfad568a-44c8-5c2c-9b78-14ecfd989b5f', 'b34f8ab9-c62f-5262-9805-c69cbd9cec05', 'ketua', 'internal_lecturer', '1a826f2d-8c7e-52ca-abfc-8ae75f1cb6c4', '7e8badc6-2777-5e2a-9c06-8a122d9a7f5b', 'Dr. Budi Santoso', '0312048501', NULL, 'Sistem Informasi', 'Teknik dan Informatika', '0000000218250097', NULL, 1),
  ('db233331-b881-5285-abe5-fd511462c33b', 'b34f8ab9-c62f-5262-9805-c69cbd9cec05', 'member', 'internal_lecturer', '9d5ccc3c-ac0a-51df-b375-5fe8699dcaeb', '58be059f-f33c-58f2-ad60-561f8e5ad55c', 'Dr. Andini Prameswari', '0308078602', NULL, 'Informatika', 'Teknik dan Informatika', '0000000319261188', NULL, 2),
  ('1297c6d0-30f1-5ff3-bf98-b39a56371d1f', 'a2c66167-6db8-5640-ab7a-457e3ae6a69f', 'ketua', 'internal_lecturer', '1a826f2d-8c7e-52ca-abfc-8ae75f1cb6c4', '7e8badc6-2777-5e2a-9c06-8a122d9a7f5b', 'Dr. Budi Santoso', '0312048501', NULL, 'Sistem Informasi', 'Teknik dan Informatika', '0000000218250097', NULL, 1),
  ('34e89eb9-0fef-5784-9002-85e51ddc4b7b', 'a2c66167-6db8-5640-ab7a-457e3ae6a69f', 'member', 'internal_lecturer', '9d5ccc3c-ac0a-51df-b375-5fe8699dcaeb', '58be059f-f33c-58f2-ad60-561f8e5ad55c', 'Dr. Andini Prameswari', '0308078602', NULL, 'Informatika', 'Teknik dan Informatika', '0000000319261188', NULL, 2),
  ('36b5d738-afee-5058-96b2-976cd100271d', 'b954b1cb-cfd5-5b74-9e90-20b865514f22', 'ketua', 'internal_lecturer', '1a826f2d-8c7e-52ca-abfc-8ae75f1cb6c4', '7e8badc6-2777-5e2a-9c06-8a122d9a7f5b', 'Dr. Budi Santoso', '0312048501', NULL, 'Sistem Informasi', 'Teknik dan Informatika', '0000000218250097', NULL, 1),
  ('2224565e-f62f-58da-8100-f6bff35febde', 'b954b1cb-cfd5-5b74-9e90-20b865514f22', 'member', 'internal_lecturer', '9d5ccc3c-ac0a-51df-b375-5fe8699dcaeb', '58be059f-f33c-58f2-ad60-561f8e5ad55c', 'Dr. Andini Prameswari', '0308078602', NULL, 'Informatika', 'Teknik dan Informatika', '0000000319261188', NULL, 2),
  ('400530ed-9383-529f-8ae7-3704e3f8043f', '60d7ffc0-da80-580c-b4d2-2e17b94e4698', 'ketua', 'internal_lecturer', '1a826f2d-8c7e-52ca-abfc-8ae75f1cb6c4', '7e8badc6-2777-5e2a-9c06-8a122d9a7f5b', 'Dr. Budi Santoso', '0312048501', NULL, 'Sistem Informasi', 'Teknik dan Informatika', '0000000218250097', NULL, 1),
  ('09b9322f-1d15-5bb2-8bb0-057eeb4f9157', '60d7ffc0-da80-580c-b4d2-2e17b94e4698', 'member', 'internal_lecturer', '9d5ccc3c-ac0a-51df-b375-5fe8699dcaeb', '58be059f-f33c-58f2-ad60-561f8e5ad55c', 'Dr. Andini Prameswari', '0308078602', NULL, 'Informatika', 'Teknik dan Informatika', '0000000319261188', NULL, 2);

INSERT INTO draft_budget_items (id, draft_id, category_code, section_key, section_label, component, item_name, volume, unit, unit_price, notes, position) VALUES
  ('fcef5bdd-6d56-585b-b35b-17e3cf290b67', '0d2ba50b-ddf0-52b0-9af6-f18ab2f60835', 'materials', 'materials', 'Bahan dan Peralatan', 'Bahan habis pakai', 'Perangkat sensor', 4, 'unit', 1250000, 'Perangkat prototipe', 1),
  ('272bff4f-5bd6-5654-9ebe-9ebcc7233fec', '0d2ba50b-ddf0-52b0-9af6-f18ab2f60835', 'analysis', 'analysis', 'Analisis Data', 'Pengolahan data', 'Cloud computing', 6, 'bulan', 750000, '', 2),
  ('5870be33-36d1-5c29-a812-360a01cc5f24', 'b34f8ab9-c62f-5262-9805-c69cbd9cec05', 'materials', 'materials', 'Bahan dan Peralatan', 'Bahan habis pakai', 'Perangkat sensor', 4, 'unit', 1250000, 'Perangkat prototipe', 1),
  ('de7ec5d0-ed02-5c24-96e9-f4d803b5326e', 'b34f8ab9-c62f-5262-9805-c69cbd9cec05', 'analysis', 'analysis', 'Analisis Data', 'Pengolahan data', 'Cloud computing', 6, 'bulan', 750000, '', 2),
  ('3d5884a0-3491-5bd0-84ac-e236a0a135a0', 'a2c66167-6db8-5640-ab7a-457e3ae6a69f', 'materials', 'materials', 'Bahan dan Peralatan', 'Bahan habis pakai', 'Perangkat sensor', 4, 'unit', 1250000, 'Perangkat prototipe', 1),
  ('187086e7-d16c-5daf-b146-5deb3764cd74', 'a2c66167-6db8-5640-ab7a-457e3ae6a69f', 'analysis', 'analysis', 'Analisis Data', 'Pengolahan data', 'Cloud computing', 6, 'bulan', 750000, '', 2),
  ('5a783fc2-bd77-541b-99c9-ed4a3ae3d778', 'b954b1cb-cfd5-5b74-9e90-20b865514f22', 'materials', 'materials', 'Bahan dan Peralatan', 'Bahan habis pakai', 'Perangkat sensor', 4, 'unit', 1250000, 'Perangkat prototipe', 1),
  ('d48da699-7bd7-588c-9cc0-3f46cd6d325a', 'b954b1cb-cfd5-5b74-9e90-20b865514f22', 'analysis', 'analysis', 'Analisis Data', 'Pengolahan data', 'Cloud computing', 6, 'bulan', 750000, '', 2),
  ('6ba1918f-f25c-591f-ae8e-33e401382623', '60d7ffc0-da80-580c-b4d2-2e17b94e4698', 'materials', 'materials', 'Bahan dan Peralatan', 'Bahan habis pakai', 'Perangkat sensor', 4, 'unit', 1250000, 'Perangkat prototipe', 1),
  ('ffeb4c99-8b12-57aa-be14-10e98be8832e', '60d7ffc0-da80-580c-b4d2-2e17b94e4698', 'analysis', 'analysis', 'Analisis Data', 'Pengolahan data', 'Cloud computing', 6, 'bulan', 750000, '', 2);

INSERT INTO draft_outputs (id, draft_id, scheme_output_option_id, output_kind, name, category, description, configuration, position) VALUES
  ('fa3931c5-a52b-5e23-aa22-a43a4bc69937', '0d2ba50b-ddf0-52b0-9af6-f18ab2f60835', NULL, 'wajib', 'Artikel Analitik Penelitian', 'jurnal', 'Artikel pada jurnal internasional bereputasi.', '{"planValue":"","planLabel":"","title":"Artikel Analitik Penelitian","targetYear":2026,"journalTargetLevel":"scopus","journalIndexTarget":"Scopus Q2","publicationType":"internasional","targetQuartile":"Q2","proceedingType":"","indexTarget":"","bookType":"","publisherTarget":"","isbnPlan":"","hkiType":"","targetRegistrationYear":"","productType":"","targetTkt":"","expectedOutputForm":"","otherOutputType":"","id":"output-1"}'::jsonb, 1),
  ('951dc558-25c1-5c14-bf3b-d227c2064ccc', 'b34f8ab9-c62f-5262-9805-c69cbd9cec05', NULL, 'wajib', 'Artikel Analitik Penelitian', 'jurnal', 'Artikel pada jurnal internasional bereputasi.', '{"planValue":"","planLabel":"","title":"Artikel Analitik Penelitian","targetYear":2026,"journalTargetLevel":"scopus","journalIndexTarget":"Scopus Q2","publicationType":"internasional","targetQuartile":"Q2","proceedingType":"","indexTarget":"","bookType":"","publisherTarget":"","isbnPlan":"","hkiType":"","targetRegistrationYear":"","productType":"","targetTkt":"","expectedOutputForm":"","otherOutputType":"","id":"output-1"}'::jsonb, 1),
  ('140509a7-8510-5aa3-a891-d64e99982418', 'a2c66167-6db8-5640-ab7a-457e3ae6a69f', NULL, 'wajib', 'Artikel Analitik Penelitian', 'jurnal', 'Artikel pada jurnal internasional bereputasi.', '{"planValue":"","planLabel":"","title":"Artikel Analitik Penelitian","targetYear":2026,"journalTargetLevel":"scopus","journalIndexTarget":"Scopus Q2","publicationType":"internasional","targetQuartile":"Q2","proceedingType":"","indexTarget":"","bookType":"","publisherTarget":"","isbnPlan":"","hkiType":"","targetRegistrationYear":"","productType":"","targetTkt":"","expectedOutputForm":"","otherOutputType":"","id":"output-1"}'::jsonb, 1),
  ('c5616cdd-15b1-562f-977b-bc66c220cfa2', 'b954b1cb-cfd5-5b74-9e90-20b865514f22', NULL, 'wajib', 'Artikel Analitik Penelitian', 'jurnal', 'Artikel pada jurnal internasional bereputasi.', '{"planValue":"","planLabel":"","title":"Artikel Analitik Penelitian","targetYear":2026,"journalTargetLevel":"scopus","journalIndexTarget":"Scopus Q2","publicationType":"internasional","targetQuartile":"Q2","proceedingType":"","indexTarget":"","bookType":"","publisherTarget":"","isbnPlan":"","hkiType":"","targetRegistrationYear":"","productType":"","targetTkt":"","expectedOutputForm":"","otherOutputType":"","id":"output-1"}'::jsonb, 1),
  ('c042da0f-7279-54ea-885e-1993bad0b781', 'b954b1cb-cfd5-5b74-9e90-20b865514f22', NULL, 'tambahan', 'Prototype Dashboard Analitik Penelitian', 'produk_prototipe', 'Prototype dashboard sebagai luaran tambahan penelitian.', '{"planValue":"","planLabel":"","title":"","targetYear":"","journalTargetLevel":"","journalIndexTarget":"","publicationType":"","targetQuartile":"","proceedingType":"","indexTarget":"","bookType":"","publisherTarget":"","isbnPlan":"","hkiType":"","targetRegistrationYear":"","productType":"prototype","targetTkt":"TKT 6","expectedOutputForm":"prototype","otherOutputType":"","id":"output-funded-additional"}'::jsonb, 2),
  ('61c4a79b-659e-54db-8068-c281913cc73f', '60d7ffc0-da80-580c-b4d2-2e17b94e4698', NULL, 'wajib', 'Artikel Analitik Penelitian', 'jurnal', 'Artikel pada jurnal internasional bereputasi.', '{"planValue":"","planLabel":"","title":"Artikel Analitik Penelitian","targetYear":2026,"journalTargetLevel":"scopus","journalIndexTarget":"Scopus Q2","publicationType":"internasional","targetQuartile":"Q2","proceedingType":"","indexTarget":"","bookType":"","publisherTarget":"","isbnPlan":"","hkiType":"","targetRegistrationYear":"","productType":"","targetTkt":"","expectedOutputForm":"","otherOutputType":"","id":"output-1"}'::jsonb, 1);

INSERT INTO draft_files (id, draft_id, requirement_id, category, file_id, uploaded_by, uploaded_at) VALUES
  ('75aceae8-bd1a-5cab-a0f4-093decd5a9ce', '0d2ba50b-ddf0-52b0-9af6-f18ab2f60835', 'f77e031a-97e5-5d93-ac83-19f4e9068db6', 'proposal', 'ced94c08-80c5-5612-9022-194207541a59', '7e8badc6-2777-5e2a-9c06-8a122d9a7f5b', '2026-05-04T08:30:00.000Z'),
  ('3bc95dea-2916-5e0a-9695-88d56d6042ec', '0d2ba50b-ddf0-52b0-9af6-f18ab2f60835', '51e57683-ea3d-547f-b6d1-abfd4a04d4ba', 'rab', '2fda302a-bd12-5d52-9d75-7f70022f0cda', '7e8badc6-2777-5e2a-9c06-8a122d9a7f5b', '2026-05-04T08:30:00.000Z'),
  ('2686df5e-1cb4-53c9-b445-ab4f69d6c391', 'b34f8ab9-c62f-5262-9805-c69cbd9cec05', 'e99813c2-ee5b-54b5-a266-c19c082271e8', 'proposal', '213b5ee7-e10d-50de-a396-5b3013ced633', '7e8badc6-2777-5e2a-9c06-8a122d9a7f5b', '2026-05-04T08:30:00.000Z'),
  ('2ed133af-2f8f-5f36-bd47-98eb5b41ca32', 'b34f8ab9-c62f-5262-9805-c69cbd9cec05', '032df386-0d40-5ed4-9eaf-d9dcb1e2fc86', 'rab', 'a08e3dca-08a8-5f6d-9535-34b9eb8b4fcb', '7e8badc6-2777-5e2a-9c06-8a122d9a7f5b', '2026-05-04T08:30:00.000Z'),
  ('ee94fc4a-af09-51c9-a242-2935f0f42ecb', 'a2c66167-6db8-5640-ab7a-457e3ae6a69f', '7edc1008-a09b-52d3-b2a7-532d42e13d9a', 'proposal', '17ab9053-7a29-5c26-8927-0fa470160572', '7e8badc6-2777-5e2a-9c06-8a122d9a7f5b', '2026-05-04T08:30:00.000Z'),
  ('6cc55c1d-12cd-5214-91f6-a1cf6c006574', 'a2c66167-6db8-5640-ab7a-457e3ae6a69f', '08a6cfd8-57f6-5de5-a7c0-a322f91ef029', 'rab', '3f51b40e-d76b-5f42-b4b9-d0f73bebce80', '7e8badc6-2777-5e2a-9c06-8a122d9a7f5b', '2026-05-04T08:30:00.000Z'),
  ('b97b45c8-ccb9-55c6-96a1-7b3fe29dda2a', 'b954b1cb-cfd5-5b74-9e90-20b865514f22', 'f77e031a-97e5-5d93-ac83-19f4e9068db6', 'proposal', '0a7564d5-c3d1-544d-977c-a6d643cbff37', '7e8badc6-2777-5e2a-9c06-8a122d9a7f5b', '2026-05-04T08:30:00.000Z'),
  ('31369322-615b-53eb-8d28-55f17de10e23', 'b954b1cb-cfd5-5b74-9e90-20b865514f22', '51e57683-ea3d-547f-b6d1-abfd4a04d4ba', 'rab', '5c9e73d1-49c4-5e1a-8796-959f7ac39768', '7e8badc6-2777-5e2a-9c06-8a122d9a7f5b', '2026-05-04T08:30:00.000Z'),
  ('dfe43bd5-6091-588c-ac23-63187e78c941', '60d7ffc0-da80-580c-b4d2-2e17b94e4698', '5a45e871-f351-503a-b1cd-e9135bc1c27f', 'proposal', '64d7fd4a-14de-5ecb-ab04-ddef65f01b37', '7e8badc6-2777-5e2a-9c06-8a122d9a7f5b', '2026-05-04T08:30:00.000Z'),
  ('b090a051-5864-5704-8cbd-f855b9a18747', '60d7ffc0-da80-580c-b4d2-2e17b94e4698', 'a02dfe43-668d-5f7a-9025-9eb58d052b11', 'rab', '36973866-5ee0-5917-aceb-1941ffecafa0', '7e8badc6-2777-5e2a-9c06-8a122d9a7f5b', '2026-05-04T08:30:00.000Z');

INSERT INTO proposal_submissions (id, draft_id, revision_number, snapshot, submitted_by, submitted_at) VALUES
  ('6ae6cf8c-57d0-51e8-b85a-cd7f0f3580d7', '0d2ba50b-ddf0-52b0-9af6-f18ab2f60835', 1, '{"project":{"title":"Pengembangan Sistem Analitik Penelitian Berbasis Kecerdasan Buatan","mandatoryOutputPlan":"scopus_q2","additionalOutputPlan":"prototype","additionalOutputPlans":["prototype"],"targetTkt":5,"ripRelation":"ict_based","researchCenterRelation":"ict_based","sdgs":[4,9],"integrated":true,"courseName":"machine_learning","academicYear":"2025/2026"},"members":[{"id":"member-1","role":"ketua","type":"internal_lecturer","profileId":"lecturer-1","name":"Dr. Budi Santoso","nidn":"0312048501","program":"Sistem Informasi","faculty":"Teknik dan Informatika","orcid":"0000000218250097"},{"id":"member-2","role":"member","type":"internal_lecturer","profileId":"lecturer-2","name":"Dr. Andini Prameswari","nidn":"0308078602","program":"Informatika","faculty":"Teknik dan Informatika","orcid":"0000000319261188"}],"budgets":[{"id":"budget-1","tab":"materials","component":"Bahan habis pakai","name":"Perangkat sensor","volume":4,"unit":"unit","unitPrice":1250000,"notes":"Perangkat prototipe"},{"id":"budget-2","tab":"analysis","component":"Pengolahan data","name":"Cloud computing","volume":6,"unit":"bulan","unitPrice":750000,"notes":""}],"outputs":[{"planValue":"","planLabel":"","title":"Artikel Analitik Penelitian","targetYear":2026,"description":"Artikel pada jurnal internasional bereputasi.","category":"jurnal","journalTargetLevel":"scopus","journalIndexTarget":"Scopus Q2","publicationType":"internasional","targetQuartile":"Q2","proceedingType":"","indexTarget":"","bookType":"","publisherTarget":"","isbnPlan":"","hkiType":"","targetRegistrationYear":"","productType":"","targetTkt":"","expectedOutputForm":"","otherOutputType":"","id":"output-1","type":"wajib"}],"files":[{"id":"file-1","category":"proposal","name":"proposal-penelitian.pdf","size":1843200,"type":"application/pdf"},{"id":"file-2","category":"rab","name":"rab-penelitian.xlsx","size":245760,"type":"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}]}'::jsonb, '7e8badc6-2777-5e2a-9c06-8a122d9a7f5b', '2026-05-06T03:15:00.000Z'),
  ('49ac5453-119f-5dda-9e69-3aa64a0098d1', 'b34f8ab9-c62f-5262-9805-c69cbd9cec05', 1, '{"project":{"title":"Model Prediksi Keberhasilan Studi Mahasiswa Menggunakan Machine Learning","mandatoryOutputPlan":"scopus_q2","additionalOutputPlan":"prototype","additionalOutputPlans":["prototype"],"targetTkt":5,"ripRelation":"ict_based","researchCenterRelation":"ict_based","sdgs":[4,9],"integrated":true,"courseName":"machine_learning","academicYear":"2025/2026"},"members":[{"id":"member-1","role":"ketua","type":"internal_lecturer","profileId":"lecturer-1","name":"Dr. Budi Santoso","nidn":"0312048501","program":"Sistem Informasi","faculty":"Teknik dan Informatika","orcid":"0000000218250097"},{"id":"member-2","role":"member","type":"internal_lecturer","profileId":"lecturer-2","name":"Dr. Andini Prameswari","nidn":"0308078602","program":"Informatika","faculty":"Teknik dan Informatika","orcid":"0000000319261188"}],"budgets":[{"id":"budget-1","tab":"materials","component":"Bahan habis pakai","name":"Perangkat sensor","volume":4,"unit":"unit","unitPrice":1250000,"notes":"Perangkat prototipe"},{"id":"budget-2","tab":"analysis","component":"Pengolahan data","name":"Cloud computing","volume":6,"unit":"bulan","unitPrice":750000,"notes":""}],"outputs":[{"planValue":"","planLabel":"","title":"Artikel Analitik Penelitian","targetYear":2026,"description":"Artikel pada jurnal internasional bereputasi.","category":"jurnal","journalTargetLevel":"scopus","journalIndexTarget":"Scopus Q2","publicationType":"internasional","targetQuartile":"Q2","proceedingType":"","indexTarget":"","bookType":"","publisherTarget":"","isbnPlan":"","hkiType":"","targetRegistrationYear":"","productType":"","targetTkt":"","expectedOutputForm":"","otherOutputType":"","id":"output-1","type":"wajib"}],"files":[{"id":"file-1","category":"proposal","name":"proposal-penelitian.pdf","size":1843200,"type":"application/pdf"},{"id":"file-2","category":"rab","name":"rab-penelitian.xlsx","size":245760,"type":"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}]}'::jsonb, '7e8badc6-2777-5e2a-9c06-8a122d9a7f5b', '2026-05-06T03:15:00.000Z'),
  ('abcd5584-8892-51df-bf0c-a482999fc077', 'a2c66167-6db8-5640-ab7a-457e3ae6a69f', 1, '{"project":{"title":"Platform Kolaborasi Riset Universitas dan Industri Kreatif","mandatoryOutputPlan":"scopus_q2","additionalOutputPlan":"prototype","additionalOutputPlans":["prototype"],"targetTkt":5,"ripRelation":"ict_based","researchCenterRelation":"ict_based","sdgs":[4,9],"integrated":true,"courseName":"machine_learning","academicYear":"2025/2026"},"members":[{"id":"member-1","role":"ketua","type":"internal_lecturer","profileId":"lecturer-1","name":"Dr. Budi Santoso","nidn":"0312048501","program":"Sistem Informasi","faculty":"Teknik dan Informatika","orcid":"0000000218250097"},{"id":"member-2","role":"member","type":"internal_lecturer","profileId":"lecturer-2","name":"Dr. Andini Prameswari","nidn":"0308078602","program":"Informatika","faculty":"Teknik dan Informatika","orcid":"0000000319261188"}],"budgets":[{"id":"budget-1","tab":"materials","component":"Bahan habis pakai","name":"Perangkat sensor","volume":4,"unit":"unit","unitPrice":1250000,"notes":"Perangkat prototipe"},{"id":"budget-2","tab":"analysis","component":"Pengolahan data","name":"Cloud computing","volume":6,"unit":"bulan","unitPrice":750000,"notes":""}],"outputs":[{"planValue":"","planLabel":"","title":"Artikel Analitik Penelitian","targetYear":2026,"description":"Artikel pada jurnal internasional bereputasi.","category":"jurnal","journalTargetLevel":"scopus","journalIndexTarget":"Scopus Q2","publicationType":"internasional","targetQuartile":"Q2","proceedingType":"","indexTarget":"","bookType":"","publisherTarget":"","isbnPlan":"","hkiType":"","targetRegistrationYear":"","productType":"","targetTkt":"","expectedOutputForm":"","otherOutputType":"","id":"output-1","type":"wajib"}],"files":[{"id":"file-1","category":"proposal","name":"proposal-penelitian.pdf","size":1843200,"type":"application/pdf"},{"id":"file-2","category":"rab","name":"rab-penelitian.xlsx","size":245760,"type":"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}]}'::jsonb, '7e8badc6-2777-5e2a-9c06-8a122d9a7f5b', '2026-05-06T03:15:00.000Z'),
  ('1b9a8db8-fea2-516b-ae1d-b66b26650a0e', 'b954b1cb-cfd5-5b74-9e90-20b865514f22', 1, '{"project":{"title":"Pengembangan Repositori Riset Terintegrasi","mandatoryOutputPlan":"scopus_q2","additionalOutputPlan":"prototype","additionalOutputPlans":["prototype"],"targetTkt":5,"ripRelation":"ict_based","researchCenterRelation":"ict_based","sdgs":[4,9],"integrated":true,"courseName":"machine_learning","academicYear":"2025/2026"},"members":[{"id":"member-1","role":"ketua","type":"internal_lecturer","profileId":"lecturer-1","name":"Dr. Budi Santoso","nidn":"0312048501","program":"Sistem Informasi","faculty":"Teknik dan Informatika","orcid":"0000000218250097"},{"id":"member-2","role":"member","type":"internal_lecturer","profileId":"lecturer-2","name":"Dr. Andini Prameswari","nidn":"0308078602","program":"Informatika","faculty":"Teknik dan Informatika","orcid":"0000000319261188"}],"budgets":[{"id":"budget-1","tab":"materials","component":"Bahan habis pakai","name":"Perangkat sensor","volume":4,"unit":"unit","unitPrice":1250000,"notes":"Perangkat prototipe"},{"id":"budget-2","tab":"analysis","component":"Pengolahan data","name":"Cloud computing","volume":6,"unit":"bulan","unitPrice":750000,"notes":""}],"outputs":[{"planValue":"","planLabel":"","title":"Artikel Analitik Penelitian","targetYear":2026,"description":"Artikel pada jurnal internasional bereputasi.","category":"jurnal","journalTargetLevel":"scopus","journalIndexTarget":"Scopus Q2","publicationType":"internasional","targetQuartile":"Q2","proceedingType":"","indexTarget":"","bookType":"","publisherTarget":"","isbnPlan":"","hkiType":"","targetRegistrationYear":"","productType":"","targetTkt":"","expectedOutputForm":"","otherOutputType":"","id":"output-1","type":"wajib"},{"planValue":"","planLabel":"","title":"","targetYear":"","description":"Prototype dashboard sebagai luaran tambahan penelitian.","category":"produk_prototipe","journalTargetLevel":"","journalIndexTarget":"","publicationType":"","targetQuartile":"","proceedingType":"","indexTarget":"","bookType":"","publisherTarget":"","isbnPlan":"","hkiType":"","targetRegistrationYear":"","productType":"prototype","targetTkt":"TKT 6","expectedOutputForm":"prototype","otherOutputType":"","id":"output-funded-additional","name":"Prototype Dashboard Analitik Penelitian","type":"tambahan"}],"files":[{"id":"file-1","category":"proposal","name":"proposal-penelitian.pdf","size":1843200,"type":"application/pdf"},{"id":"file-2","category":"rab","name":"rab-penelitian.xlsx","size":245760,"type":"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}]}'::jsonb, '7e8badc6-2777-5e2a-9c06-8a122d9a7f5b', '2026-05-06T03:15:00.000Z');

INSERT INTO proposal_verifications (id, draft_id, status, checklist, notes, verified_by, verified_at) VALUES
  ('b83d8b70-3dba-5201-8ba6-250ceed2a1ce', 'b34f8ab9-c62f-5262-9805-c69cbd9cec05', 'verified', '{"project":true,"members":true,"budget":true,"outputs":true,"attachments":true}'::jsonb, NULL, 'a578e542-9765-56f2-9e76-11ea5ba7fa89', '2026-05-08T06:30:00.000Z'),
  ('81421a0d-b866-504a-854c-3a3b43256260', 'a2c66167-6db8-5640-ab7a-457e3ae6a69f', 'verified', '{"project":true,"members":true,"budget":true,"outputs":true,"attachments":true}'::jsonb, NULL, 'a578e542-9765-56f2-9e76-11ea5ba7fa89', '2026-05-08T06:30:00.000Z'),
  ('5ab8eb69-4a72-5ee5-84e3-883f417a7dd8', 'b954b1cb-cfd5-5b74-9e90-20b865514f22', 'verified', '{"project":true,"members":true,"budget":true,"outputs":true,"attachments":true}'::jsonb, NULL, 'a578e542-9765-56f2-9e76-11ea5ba7fa89', '2026-05-08T06:30:00.000Z');

INSERT INTO reviewer_assignments (id, draft_id, submission_id, reviewer_id, status, assigned_by, assigned_at, due_at, submitted_at, revoked_at, revoked_by) VALUES
  ('c22d41bd-43fa-52c6-bdbc-9936e48b1eea', 'b34f8ab9-c62f-5262-9805-c69cbd9cec05', '49ac5453-119f-5dda-9e69-3aa64a0098d1', '58be059f-f33c-58f2-ad60-561f8e5ad55c', 'assigned', 'a578e542-9765-56f2-9e76-11ea5ba7fa89', '2026-05-08T07:00:00.000Z', '2026-08-04T16:59:00.000Z', NULL, NULL, NULL),
  ('745ef1bf-29f8-5a28-abc3-24e0cf8fc908', 'a2c66167-6db8-5640-ab7a-457e3ae6a69f', 'abcd5584-8892-51df-bf0c-a482999fc077', '58be059f-f33c-58f2-ad60-561f8e5ad55c', 'submitted', 'a578e542-9765-56f2-9e76-11ea5ba7fa89', '2026-05-08T07:00:00.000Z', '2026-05-20T16:59:00.000Z', '2026-05-10T04:00:00.000Z', NULL, NULL),
  ('00e274b5-2e19-5dfe-8d0a-2a812a07ca5d', 'a2c66167-6db8-5640-ab7a-457e3ae6a69f', 'abcd5584-8892-51df-bf0c-a482999fc077', '08483b04-e38e-5602-b3de-2cd73d02fd40', 'assigned', 'a578e542-9765-56f2-9e76-11ea5ba7fa89', '2026-05-08T07:00:00.000Z', '2026-07-31T16:59:00.000Z', NULL, NULL, NULL),
  ('fe304428-073e-5b7e-9c0b-b159c4152fd8', 'b954b1cb-cfd5-5b74-9e90-20b865514f22', '1b9a8db8-fea2-516b-ae1d-b66b26650a0e', '58be059f-f33c-58f2-ad60-561f8e5ad55c', 'revoked', 'a578e542-9765-56f2-9e76-11ea5ba7fa89', '2026-05-08T07:00:00.000Z', '2026-05-20T16:59:00.000Z', '2026-05-10T04:00:00.000Z', '2026-05-12T04:00:00.000Z', '9263f343-101a-5c74-8740-ad6e2958cd84');

INSERT INTO submission_reviews (id, assignment_id, recommendation, total_score, strengths, weaknesses, budget_notes, output_notes, revision_notes, submitted_at, updated_at) VALUES
  ('8fd1625e-e6eb-5734-bf5e-28c3f113dfab', '745ef1bf-29f8-5a28-abc3-24e0cf8fc908', 'approve', 82, 'Topik relevan dan metodologi jelas.', 'Rencana diseminasi perlu dirinci.', 'Anggaran wajar.', 'Target luaran realistis.', '', '2026-05-10T04:00:00.000Z', '2026-05-10T04:00:00.000Z'),
  ('76bb87ce-124e-577f-a6ff-00d80fb95813', 'fe304428-073e-5b7e-9c0b-b159c4152fd8', 'approve', 88, 'Rancangan integrasi dan dampak institusional sangat kuat.', 'Rencana mitigasi migrasi data perlu diperdalam.', 'Anggaran proporsional.', 'Luaran terukur dan relevan.', '', '2026-05-10T04:00:00.000Z', '2026-05-10T04:00:00.000Z');

INSERT INTO review_score_details (review_id, criteria_code, score, weighted_score) VALUES
  ('8fd1625e-e6eb-5734-bf5e-28c3f113dfab', 'kejelasan_masalah', 82, 8.2),
  ('8fd1625e-e6eb-5734-bf5e-28c3f113dfab', 'kebaruan_penelitian', 82, 8.2),
  ('8fd1625e-e6eb-5734-bf5e-28c3f113dfab', 'metodologi', 82, 8.2),
  ('8fd1625e-e6eb-5734-bf5e-28c3f113dfab', 'kompetensi_ketua', 82, 6.56),
  ('8fd1625e-e6eb-5734-bf5e-28c3f113dfab', 'komposisi_tim', 82, 5.74),
  ('8fd1625e-e6eb-5734-bf5e-28c3f113dfab', 'kesesuaian_luaran', 82, 8.2),
  ('8fd1625e-e6eb-5734-bf5e-28c3f113dfab', 'realisme_target', 82, 8.2),
  ('8fd1625e-e6eb-5734-bf5e-28c3f113dfab', 'kewajaran_biaya', 82, 8.2),
  ('8fd1625e-e6eb-5734-bf5e-28c3f113dfab', 'kesesuaian_kegiatan', 82, 8.2),
  ('8fd1625e-e6eb-5734-bf5e-28c3f113dfab', 'rip', 82, 4.1),
  ('8fd1625e-e6eb-5734-bf5e-28c3f113dfab', 'sdg', 82, 4.1),
  ('8fd1625e-e6eb-5734-bf5e-28c3f113dfab', 'research_center', 82, 4.1),
  ('76bb87ce-124e-577f-a6ff-00d80fb95813', 'kejelasan_masalah', 88, 8.8),
  ('76bb87ce-124e-577f-a6ff-00d80fb95813', 'kebaruan_penelitian', 88, 8.8),
  ('76bb87ce-124e-577f-a6ff-00d80fb95813', 'metodologi', 88, 8.8),
  ('76bb87ce-124e-577f-a6ff-00d80fb95813', 'kompetensi_ketua', 88, 7.04),
  ('76bb87ce-124e-577f-a6ff-00d80fb95813', 'komposisi_tim', 88, 6.16),
  ('76bb87ce-124e-577f-a6ff-00d80fb95813', 'kesesuaian_luaran', 88, 8.8),
  ('76bb87ce-124e-577f-a6ff-00d80fb95813', 'realisme_target', 88, 8.8),
  ('76bb87ce-124e-577f-a6ff-00d80fb95813', 'kewajaran_biaya', 88, 8.8),
  ('76bb87ce-124e-577f-a6ff-00d80fb95813', 'kesesuaian_kegiatan', 88, 8.8),
  ('76bb87ce-124e-577f-a6ff-00d80fb95813', 'rip', 88, 4.4),
  ('76bb87ce-124e-577f-a6ff-00d80fb95813', 'sdg', 88, 4.4),
  ('76bb87ce-124e-577f-a6ff-00d80fb95813', 'research_center', 88, 4.4);

INSERT INTO proposal_decisions (id, draft_id, decision_round, decision, notes, decided_by, signer_name, signer_role, decided_at) VALUES
  ('32367ce3-db22-5de5-a266-31de88cdc803', 'b954b1cb-cfd5-5b74-9e90-20b865514f22', 1, 'funded', 'Proposal disetujui untuk didanai.', '9263f343-101a-5c74-8740-ad6e2958cd84', 'Manager LPPM', 'Manager', '2026-05-12T04:00:00.000Z');

INSERT INTO funding_letters (id, draft_id, letter_number, file_name, signed_by, signer_name, signer_role, issued_at, signed_at) VALUES
  ('ea7e2342-7f19-527f-b429-1304ba5c178a', 'b954b1cb-cfd5-5b74-9e90-20b865514f22', '001/SPP-RIS/LPPM/V/2026', 'surat-penetapan-pendanaan-draft-approved.pdf', '9263f343-101a-5c74-8740-ad6e2958cd84', 'Manager LPPM', 'Manager', '2026-05-12T04:00:00.000Z', '2026-05-12T04:00:00.000Z');

INSERT INTO funded_research (id, scheme_id, lead_user_id, title, funded_amount, created_by) VALUES
  ('b954b1cb-cfd5-5b74-9e90-20b865514f22', '686d5460-a99c-5fad-bc4e-e85490147fef', '7e8badc6-2777-5e2a-9c06-8a122d9a7f5b', 'Pengembangan Repositori Riset Terintegrasi', 9500000, '9263f343-101a-5c74-8740-ad6e2958cd84');

INSERT INTO research_contracts (id, research_id, status, template_name) VALUES
  ('abd0cc5d-798f-502c-9e60-7e6882999c8f', 'b954b1cb-cfd5-5b74-9e90-20b865514f22', 'unsigned', 'template-kontrak.pdf');

INSERT INTO research_reports (id, research_id, period_id, output_id, report_type, report_period, status, payload, submitted_by, submitted_at, created_at, updated_at) VALUES
  ('8102c8f8-1531-53da-9650-fffd33f104a8', 'b954b1cb-cfd5-5b74-9e90-20b865514f22', 'f458b84c-b9ce-5287-8e5b-f95f1898edfe', NULL, 'interim', 'Laporan Sementara Periode 1', 'submitted', '{"title":"Laporan Sementara Periode 1","progress":35,"summary":"Tahap analisis kebutuhan dan perancangan arsitektur repositori telah diselesaikan.","obstacles":"Integrasi metadata dari beberapa sumber membutuhkan penyesuaian format.","followUp":"Melanjutkan implementasi prototipe dan validasi metadata bersama pengguna."}'::jsonb, '7e8badc6-2777-5e2a-9c06-8a122d9a7f5b', '2026-07-20T08:00:00.000Z', '2026-06-01T00:00:00.000Z', '2026-07-20T08:00:00.000Z');

INSERT INTO research_report_files (id, report_id, file_id, category, uploaded_at) VALUES
  ('17a280c6-a70f-54e9-910f-86ee1dec3914', '8102c8f8-1531-53da-9650-fffd33f104a8', 'dd4a1818-1c3b-5611-a19b-ffee431af5ae', 'internal_report', '2026-07-20T08:00:00.000Z');

INSERT INTO research_monev (id, research_id, period_id, period_label, status, payload, evaluated_by, published_at, created_at, updated_at) VALUES
  ('d2b58944-fecf-56e1-9345-101e43fe8821', 'b954b1cb-cfd5-5b74-9e90-20b865514f22', 'f458b84c-b9ce-5287-8e5b-f95f1898edfe', 'Laporan Sementara Periode 1', 'submitted', '{"progress":35,"milestone":"Arsitektur sistem dan rancangan metadata selesai","achievements":"Arsitektur repositori, skema metadata, dan prototipe awal berhasil disusun.","deviations":"Validasi metadata mundur satu minggu karena penyesuaian sumber data.","risks":"Perbedaan kualitas metadata dari sistem lama.","correctiveAction":"Menambahkan tahap normalisasi dan validasi metadata otomatis."}'::jsonb, 'a578e542-9765-56f2-9e76-11ea5ba7fa89', '2026-07-18T08:00:00.000Z', '2026-06-01T00:00:00.000Z', '2026-07-18T08:00:00.000Z');

INSERT INTO research_monev_files (monev_id, file_id, category) VALUES
  ('d2b58944-fecf-56e1-9345-101e43fe8821', '18dda81a-7376-511e-8e16-894f36a195f5', 'monev');

INSERT INTO funded_review_assignments (id, research_id, target_type, monev_id, report_id, reviewer_id, status, assigned_by, assigned_at, due_at, submitted_at) VALUES
  ('67d7b35b-02bf-5d7f-9356-5680765916b9', 'b954b1cb-cfd5-5b74-9e90-20b865514f22', 'monev', 'd2b58944-fecf-56e1-9345-101e43fe8821', NULL, '58be059f-f33c-58f2-ad60-561f8e5ad55c', 'assigned', 'a578e542-9765-56f2-9e76-11ea5ba7fa89', '2026-08-01T08:00:00.000Z', '2026-08-20T16:59:00.000Z', NULL),
  ('bf046d9c-1cf9-50a7-a370-1fa9531bd30c', 'b954b1cb-cfd5-5b74-9e90-20b865514f22', 'report', NULL, '8102c8f8-1531-53da-9650-fffd33f104a8', '08483b04-e38e-5602-b3de-2cd73d02fd40', 'submitted', 'a578e542-9765-56f2-9e76-11ea5ba7fa89', '2026-07-21T08:00:00.000Z', '2026-08-05T16:59:00.000Z', '2026-07-29T08:00:00.000Z');

INSERT INTO funded_reviews (id, assignment_id, recommendation, total_score, substance_notes, technical_notes, follow_up_notes, submitted_at, updated_at) VALUES
  ('2e32fc99-79e9-5087-af71-ed85189682ef', 'bf046d9c-1cf9-50a7-a370-1fa9531bd30c', 'approve', 83.55, 'Kemajuan sesuai sasaran periode dan metodologi diterapkan secara konsisten.', 'Dokumen pendukung memadai; konsistensi metadata perlu dijaga.', 'Lanjutkan validasi pengguna dan ukur dampak prototipe pada periode berikutnya.', '2026-07-29T08:00:00.000Z', '2026-07-29T08:00:00.000Z');

INSERT INTO funded_review_score_details (review_id, criteria_code, criteria_label, criteria_group, weight, score, weighted_score) VALUES
  ('2e32fc99-79e9-5087-af71-ed85189682ef', 'objective', 'Kesesuaian hasil dengan tujuan penelitian', 'Substansi Laporan (45%)', 25, 86, 21.5),
  ('2e32fc99-79e9-5087-af71-ed85189682ef', 'method', 'Ketepatan metode dan analisis', 'Substansi Laporan (45%)', 20, 84, 16.8),
  ('2e32fc99-79e9-5087-af71-ed85189682ef', 'result', 'Kelengkapan dan validitas hasil', 'Capaian Penelitian (35%)', 20, 82, 16.4),
  ('2e32fc99-79e9-5087-af71-ed85189682ef', 'output', 'Ketercapaian luaran yang dijanjikan', 'Capaian Penelitian (35%)', 15, 80, 12),
  ('2e32fc99-79e9-5087-af71-ed85189682ef', 'document', 'Kualitas dokumen dan bukti', 'Dokumentasi (20%)', 10, 85, 8.5),
  ('2e32fc99-79e9-5087-af71-ed85189682ef', 'follow_up', 'Kelayakan tindak lanjut', 'Dokumentasi (20%)', 10, 83, 8.3);

INSERT INTO research_logbooks (id, research_id, activity_date, start_time, end_time, description, payload, created_by) VALUES
  ('f2596dc4-3115-5144-b0bd-1227c1ed719c', 'b954b1cb-cfd5-5b74-9e90-20b865514f22', '2026-02-03', '08:00', '17:00', 'Melaksanakan meeting koordinasi dengan tim peneliti terkait rencana kerja penelitian.', '{"fileCount":1}'::jsonb, '7e8badc6-2777-5e2a-9c06-8a122d9a7f5b'),
  ('b0fc6416-1724-5af3-982f-6b6d29d909b4', 'b954b1cb-cfd5-5b74-9e90-20b865514f22', '2026-02-05', '09:00', '18:00', 'Melanjutkan penyusunan instrumen dan rancangan pengumpulan data.', '{"fileCount":1}'::jsonb, '7e8badc6-2777-5e2a-9c06-8a122d9a7f5b');

INSERT INTO letter_master_templates (id, name, version, template_content, fields) VALUES
  (1, 'Master Template Surat', 1, 'UNIVERSITAS MULTIMEDIA NUSANTARA

Nomor: {{letterNumber}}
Perihal: {{letterPurpose}}

Nama: {{applicantName}}
NIDN/NIP: {{applicantIdentifier}}
Program Studi: {{studyProgram}}
Fakultas: {{faculty}}

{{customFields}}

Demikian surat ini diterbitkan untuk dipergunakan sebagaimana mestinya.', '[{"id":"master-recipient","key":"recipientInstitution","label":"Instansi atau Penerima Tujuan","type":"text","required":true,"options":[]},{"id":"master-activity","key":"activityName","label":"Nama Kegiatan","type":"text","required":true,"options":[]},{"id":"master-purpose","key":"activityPurpose","label":"Keperluan Surat","type":"textarea","required":true,"options":[]},{"id":"master-date","key":"activityDate","label":"Tanggal Kegiatan","type":"date","required":true,"options":[]},{"id":"master-location","key":"activityLocation","label":"Lokasi Kegiatan","type":"text","required":false,"options":[]},{"id":"master-notes","key":"additionalNotes","label":"Keterangan Tambahan","type":"textarea","required":false,"options":[]}]'::jsonb);

INSERT INTO letter_definitions (id, name, description, letter_type, purpose, is_active, lifecycle_status, version, template_name, template_content, fields) VALUES
  ('5aacc5de-5a41-5cc0-b6c9-407c2fde9122', 'Surat Tugas Penelitian', 'Penugasan untuk kegiatan penelitian, termasuk penelitian mandiri.', 'research_assignment', 'independent_research', TRUE, 'published', 1, 'Surat Tugas Penelitian', 'UNIVERSITAS MULTIMEDIA NUSANTARA

Nomor: {{letterNumber}}
Perihal: Surat Tugas Penelitian

Nama: {{applicantName}}
NIDN/NIP: {{applicantIdentifier}}
Program Studi: {{studyProgram}}

{{customFields}}

Demikian surat ini diterbitkan untuk dipergunakan sebagaimana mestinya.', '[{"id":"letter-kind-assignment-recipient","key":"recipientInstitution","label":"Instansi atau Penerima Tujuan","type":"text","required":true,"options":[]},{"id":"letter-kind-assignment-purpose","key":"activityPurpose","label":"Keperluan Surat","type":"textarea","required":true,"options":[]},{"id":"letter-kind-assignment-date","key":"activityDate","label":"Tanggal Kegiatan","type":"date","required":true,"options":[]}]'::jsonb),
  ('e18b6d8f-de45-5bf1-8e44-51be1db3d6cc', 'Surat Pendukung Kegiatan', 'Dukungan kegiatan akademik, kerja sama, observasi, atau kegiatan lainnya.', 'support', 'other_research_activity', TRUE, 'published', 1, 'Surat Pendukung Kegiatan', 'UNIVERSITAS MULTIMEDIA NUSANTARA

Nomor: {{letterNumber}}
Perihal: Surat Pendukung Kegiatan

Nama: {{applicantName}}
NIDN/NIP: {{applicantIdentifier}}
Program Studi: {{studyProgram}}

{{customFields}}

Demikian surat ini diterbitkan untuk dipergunakan sebagaimana mestinya.', '[{"id":"letter-kind-support-recipient","key":"recipientInstitution","label":"Instansi atau Penerima Tujuan","type":"text","required":true,"options":[]},{"id":"letter-kind-support-purpose","key":"activityPurpose","label":"Keperluan Surat","type":"textarea","required":true,"options":[]},{"id":"letter-kind-support-date","key":"activityDate","label":"Tanggal Kegiatan","type":"date","required":true,"options":[]}]'::jsonb),
  ('82b939bb-dcfc-52bb-9d13-414a41fe74eb', 'Permohonan Klirens Etik', 'Permohonan pemeriksaan etik untuk kegiatan riset.', 'ethics', 'new', TRUE, 'published', 1, 'Permohonan Klirens Etik', 'UNIVERSITAS MULTIMEDIA NUSANTARA

Nomor: {{letterNumber}}
Perihal: Permohonan Klirens Etik

Nama: {{applicantName}}
NIDN/NIP: {{applicantIdentifier}}
Program Studi: {{studyProgram}}

{{customFields}}

Demikian surat ini diterbitkan untuk dipergunakan sebagaimana mestinya.', '[{"id":"letter-kind-ethics-recipient","key":"recipientInstitution","label":"Instansi atau Penerima Tujuan","type":"text","required":true,"options":[]},{"id":"letter-kind-ethics-purpose","key":"activityPurpose","label":"Keperluan Surat","type":"textarea","required":true,"options":[]},{"id":"letter-kind-ethics-date","key":"activityDate","label":"Tanggal Kegiatan","type":"date","required":true,"options":[]}]'::jsonb),
  ('a5d1b5a0-9c39-5651-9d4c-1aab50898bfc', 'Surat Tugas Perjalanan Dinas', 'Penugasan perjalanan untuk kegiatan akademik maupun nonpenelitian.', 'travel', 'research_travel', TRUE, 'published', 1, 'Surat Tugas Perjalanan Dinas', 'UNIVERSITAS MULTIMEDIA NUSANTARA

Nomor: {{letterNumber}}
Perihal: Surat Tugas Perjalanan Dinas

Nama: {{applicantName}}
NIDN/NIP: {{applicantIdentifier}}
Program Studi: {{studyProgram}}

{{customFields}}

Demikian surat ini diterbitkan untuk dipergunakan sebagaimana mestinya.', '[{"id":"letter-kind-travel-recipient","key":"recipientInstitution","label":"Instansi atau Penerima Tujuan","type":"text","required":true,"options":[]},{"id":"letter-kind-travel-purpose","key":"activityPurpose","label":"Keperluan Surat","type":"textarea","required":true,"options":[]},{"id":"letter-kind-travel-date","key":"activityDate","label":"Tanggal Kegiatan","type":"date","required":true,"options":[]}]'::jsonb),
  ('1c6b20d1-3b8e-5662-b667-f9d3d9a5f537', 'Surat Keterangan Kegiatan', 'Keterangan untuk keperluan administrasi atau kegiatan di luar penelitian.', 'custom', NULL, TRUE, 'published', 1, 'Surat Keterangan Kegiatan', 'UNIVERSITAS MULTIMEDIA NUSANTARA

Nomor: {{letterNumber}}
Perihal: Surat Keterangan Kegiatan

Nama: {{applicantName}}
NIDN/NIP: {{applicantIdentifier}}
Program Studi: {{studyProgram}}

{{customFields}}

Demikian surat ini diterbitkan untuk dipergunakan sebagaimana mestinya.', '[{"id":"letter-kind-general-recipient","key":"recipientInstitution","label":"Instansi atau Penerima Tujuan","type":"text","required":true,"options":[]},{"id":"letter-kind-general-purpose","key":"activityPurpose","label":"Keperluan Surat","type":"textarea","required":true,"options":[]},{"id":"letter-kind-general-date","key":"activityDate","label":"Tanggal Kegiatan","type":"date","required":true,"options":[]}]'::jsonb);

INSERT INTO letter_requests (id, user_id, created_by, research_id, definition_id, definition_version, definition_name, letter_type, purpose, custom_name, status, auto_fill_snapshot, form_data, submitted_at, data_submitted_at, letter_number, generated_file_url, generated_at, created_at, updated_at) VALUES
  ('f3fc2961-cfa0-5177-82de-eba46a3bce3b', '7e8badc6-2777-5e2a-9c06-8a122d9a7f5b', '7e8badc6-2777-5e2a-9c06-8a122d9a7f5b', 'b954b1cb-cfd5-5b74-9e90-20b865514f22', NULL, NULL, NULL, 'support', 'interview', NULL, 'submitted', '{"applicantName":"Dr. Budi Santoso","applicantIdentifier":"0312048501","applicantEmail":"lecturer@umn.ac.id","studyProgram":"Sistem Informasi","faculty":"Teknik dan Informatika","researchTitle":"Pengembangan Repositori Riset Terintegrasi","researchYear":2026,"researchScheme":"Penelitian Dosen Pemula 2026","researchRole":"Ketua Penelitian"}'::jsonb, '{}'::jsonb, '2026-07-20T02:05:00.000Z', NULL, NULL, NULL, NULL, '2026-07-20T02:00:00.000Z', '2026-07-20T02:05:00.000Z'),
  ('fa87951c-2d70-503a-a6c4-4277b5c5166f', '7e8badc6-2777-5e2a-9c06-8a122d9a7f5b', '7e8badc6-2777-5e2a-9c06-8a122d9a7f5b', 'b954b1cb-cfd5-5b74-9e90-20b865514f22', NULL, NULL, NULL, 'travel', 'research_travel', NULL, 'form_design', '{"applicantName":"Dr. Budi Santoso","applicantIdentifier":"0312048501","applicantEmail":"lecturer@umn.ac.id","studyProgram":"Sistem Informasi","faculty":"Teknik dan Informatika","researchTitle":"Pengembangan Repositori Riset Terintegrasi","researchYear":2026,"researchScheme":"Penelitian Dosen Pemula 2026","researchRole":"Ketua Penelitian"}'::jsonb, '{}'::jsonb, '2026-07-20T02:05:00.000Z', NULL, NULL, NULL, NULL, '2026-07-20T02:00:00.000Z', '2026-07-22T03:00:00.000Z'),
  ('7fabf43f-0cd9-5096-a4e4-dcbb3136fc9c', '7e8badc6-2777-5e2a-9c06-8a122d9a7f5b', '7e8badc6-2777-5e2a-9c06-8a122d9a7f5b', 'b954b1cb-cfd5-5b74-9e90-20b865514f22', NULL, NULL, NULL, 'ethics', 'new', NULL, 'data_required', '{"applicantName":"Dr. Budi Santoso","applicantIdentifier":"0312048501","applicantEmail":"lecturer@umn.ac.id","studyProgram":"Sistem Informasi","faculty":"Teknik dan Informatika","researchTitle":"Pengembangan Repositori Riset Terintegrasi","researchYear":2026,"researchScheme":"Penelitian Dosen Pemula 2026","researchRole":"Ketua Penelitian"}'::jsonb, '{}'::jsonb, '2026-07-20T02:05:00.000Z', NULL, NULL, NULL, NULL, '2026-07-20T02:00:00.000Z', '2026-07-24T04:00:00.000Z'),
  ('7eceb1cf-bd95-5dcb-b00c-0f0e22a1d9cc', '7e8badc6-2777-5e2a-9c06-8a122d9a7f5b', '7e8badc6-2777-5e2a-9c06-8a122d9a7f5b', 'b954b1cb-cfd5-5b74-9e90-20b865514f22', NULL, NULL, NULL, 'support', 'research_permission', NULL, 'data_submitted', '{"applicantName":"Dr. Budi Santoso","applicantIdentifier":"0312048501","applicantEmail":"lecturer@umn.ac.id","studyProgram":"Sistem Informasi","faculty":"Teknik dan Informatika","researchTitle":"Pengembangan Repositori Riset Terintegrasi","researchYear":2026,"researchScheme":"Penelitian Dosen Pemula 2026","researchRole":"Ketua Penelitian"}'::jsonb, '{"recipientInstitution":"Dinas Komunikasi dan Informatika Kota Tangerang","activityPurpose":"Permohonan akses data terbatas untuk validasi metadata repositori penelitian.","activityDate":"2026-09-10"}'::jsonb, '2026-07-20T02:05:00.000Z', '2026-07-27T04:00:00.000Z', NULL, NULL, NULL, '2026-07-20T02:00:00.000Z', '2026-07-27T04:00:00.000Z'),
  ('c1e5579f-a4f3-5725-b468-1543fc075cbb', '7e8badc6-2777-5e2a-9c06-8a122d9a7f5b', '7e8badc6-2777-5e2a-9c06-8a122d9a7f5b', 'b954b1cb-cfd5-5b74-9e90-20b865514f22', NULL, NULL, NULL, 'custom', NULL, 'Surat Keterangan Pelaksanaan Uji Lapangan', 'revision_required', '{"applicantName":"Dr. Budi Santoso","applicantIdentifier":"0312048501","applicantEmail":"lecturer@umn.ac.id","studyProgram":"Sistem Informasi","faculty":"Teknik dan Informatika","researchTitle":"Pengembangan Repositori Riset Terintegrasi","researchYear":2026,"researchScheme":"Penelitian Dosen Pemula 2026","researchRole":"Ketua Penelitian"}'::jsonb, '{"recipientInstitution":"PT Data Nusantara","activityPurpose":"","activityDate":"2026-09-18"}'::jsonb, '2026-07-20T02:05:00.000Z', NULL, NULL, NULL, NULL, '2026-07-20T02:00:00.000Z', '2026-07-29T05:00:00.000Z'),
  ('aee91c27-740e-5a33-a413-6ee09b8fd8e1', '7e8badc6-2777-5e2a-9c06-8a122d9a7f5b', '7e8badc6-2777-5e2a-9c06-8a122d9a7f5b', 'b954b1cb-cfd5-5b74-9e90-20b865514f22', NULL, NULL, NULL, 'support', 'other_research_activity', NULL, 'rejected', '{"applicantName":"Dr. Budi Santoso","applicantIdentifier":"0312048501","applicantEmail":"lecturer@umn.ac.id","studyProgram":"Sistem Informasi","faculty":"Teknik dan Informatika","researchTitle":"Pengembangan Repositori Riset Terintegrasi","researchYear":2026,"researchScheme":"Penelitian Dosen Pemula 2026","researchRole":"Ketua Penelitian"}'::jsonb, '{}'::jsonb, '2026-07-20T02:05:00.000Z', NULL, NULL, NULL, NULL, '2026-07-20T02:00:00.000Z', '2026-07-30T05:00:00.000Z'),
  ('cc9e3bc7-36e3-57cb-a823-bf40d2b9a3e3', '7e8badc6-2777-5e2a-9c06-8a122d9a7f5b', '7e8badc6-2777-5e2a-9c06-8a122d9a7f5b', 'b954b1cb-cfd5-5b74-9e90-20b865514f22', NULL, NULL, NULL, 'research_assignment', 'internal_grant', NULL, 'generated', '{"applicantName":"Dr. Budi Santoso","applicantIdentifier":"0312048501","applicantEmail":"lecturer@umn.ac.id","studyProgram":"Sistem Informasi","faculty":"Teknik dan Informatika","researchTitle":"Pengembangan Repositori Riset Terintegrasi","researchYear":2026,"researchScheme":"Penelitian Dosen Pemula 2026","researchRole":"Ketua Penelitian"}'::jsonb, '{"recipientInstitution":"LPPM Universitas Multimedia Nusantara","activityPurpose":"Pelaksanaan penelitian internal tahun 2026.","activityDate":"2026-08-15"}'::jsonb, '2026-07-20T02:05:00.000Z', NULL, '0001/ST-RIS/LPPM/08/2026', 'archive://letter-generated-1', '2026-08-01T04:00:00.000Z', '2026-07-20T02:00:00.000Z', '2026-08-01T04:00:00.000Z');

INSERT INTO letter_applicants (id, letter_id, user_id, name, identifier, applicant_role, applicant_kind, status, faculty, study_program, email, is_primary, position) VALUES
  ('3ab7478b-cf4c-57ac-80ee-3de44922eedb', 'f3fc2961-cfa0-5177-82de-eba46a3bce3b', '7e8badc6-2777-5e2a-9c06-8a122d9a7f5b', 'Dr. Budi Santoso', '0312048501', 'Dosen Fulltime', 'lecturer', 'fulltime', 'Teknik dan Informatika', 'Sistem Informasi', 'lecturer@umn.ac.id', TRUE, 1),
  ('46ded8c8-8ebf-5237-923b-d8c9464bc53f', 'fa87951c-2d70-503a-a6c4-4277b5c5166f', '7e8badc6-2777-5e2a-9c06-8a122d9a7f5b', 'Dr. Budi Santoso', '0312048501', 'Dosen Fulltime', 'lecturer', 'fulltime', 'Teknik dan Informatika', 'Sistem Informasi', 'lecturer@umn.ac.id', TRUE, 1),
  ('2041b706-1d98-59fd-b1d2-37a73bbce6a6', '7fabf43f-0cd9-5096-a4e4-dcbb3136fc9c', '7e8badc6-2777-5e2a-9c06-8a122d9a7f5b', 'Dr. Budi Santoso', '0312048501', 'Dosen Fulltime', 'lecturer', 'fulltime', 'Teknik dan Informatika', 'Sistem Informasi', 'lecturer@umn.ac.id', TRUE, 1),
  ('f73ed268-5960-5849-b597-3f256d725915', '7eceb1cf-bd95-5dcb-b00c-0f0e22a1d9cc', '7e8badc6-2777-5e2a-9c06-8a122d9a7f5b', 'Dr. Budi Santoso', '0312048501', 'Dosen Fulltime', 'lecturer', 'fulltime', 'Teknik dan Informatika', 'Sistem Informasi', 'lecturer@umn.ac.id', TRUE, 1),
  ('e511fec9-22b5-5e44-bd30-f8bc6334f1a7', 'c1e5579f-a4f3-5725-b468-1543fc075cbb', '7e8badc6-2777-5e2a-9c06-8a122d9a7f5b', 'Dr. Budi Santoso', '0312048501', 'Dosen Fulltime', 'lecturer', 'fulltime', 'Teknik dan Informatika', 'Sistem Informasi', 'lecturer@umn.ac.id', TRUE, 1),
  ('802c3273-6d11-504a-a1f9-198bae0b6a17', 'aee91c27-740e-5a33-a413-6ee09b8fd8e1', '7e8badc6-2777-5e2a-9c06-8a122d9a7f5b', 'Dr. Budi Santoso', '0312048501', 'Dosen Fulltime', 'lecturer', 'fulltime', 'Teknik dan Informatika', 'Sistem Informasi', 'lecturer@umn.ac.id', TRUE, 1),
  ('f7e68533-ac8c-5211-ac0c-a62891c69a6f', 'cc9e3bc7-36e3-57cb-a823-bf40d2b9a3e3', '7e8badc6-2777-5e2a-9c06-8a122d9a7f5b', 'Dr. Budi Santoso', '0312048501', 'Dosen Fulltime', 'lecturer', 'fulltime', 'Teknik dan Informatika', 'Sistem Informasi', 'lecturer@umn.ac.id', TRUE, 1);

INSERT INTO letter_request_templates (id, letter_id, template_name, content_template, configured_by, configured_at) VALUES
  ('b05c8b7c-9476-50b3-85db-ada52e9b2046', 'fa87951c-2d70-503a-a6c4-4277b5c5166f', 'Template Surat Tugas Perjalanan Penelitian', 'RESEARCH INNOVATION AND SUSTAINABILITY
UNIVERSITAS MULTIMEDIA NUSANTARA

Nomor: {{letterNumber}}

Dengan ini menerangkan bahwa {{applicantName}} ({{applicantIdentifier}}) dari {{studyProgram}} sedang melaksanakan penelitian "{{researchTitle}}" pada skema {{researchScheme}}.

{{customFields}}

Demikian surat ini diterbitkan untuk dipergunakan sebagaimana mestinya.', '3b35bd0a-39f9-5ff0-b419-f46cc0dee60e', '2026-07-22T03:00:00.000Z'),
  ('3e0e650a-0951-51bd-bcc2-f2d98413ab3d', '7fabf43f-0cd9-5096-a4e4-dcbb3136fc9c', 'Template Permohonan Klirens Etik', 'RESEARCH INNOVATION AND SUSTAINABILITY
UNIVERSITAS MULTIMEDIA NUSANTARA

Nomor: {{letterNumber}}

Dengan ini menerangkan bahwa {{applicantName}} ({{applicantIdentifier}}) dari {{studyProgram}} sedang melaksanakan penelitian "{{researchTitle}}" pada skema {{researchScheme}}.

{{customFields}}

Demikian surat ini diterbitkan untuk dipergunakan sebagaimana mestinya.', '3b35bd0a-39f9-5ff0-b419-f46cc0dee60e', '2026-07-24T04:00:00.000Z'),
  ('8dc535ce-f664-5821-aabc-bce7e96be920', '7eceb1cf-bd95-5dcb-b00c-0f0e22a1d9cc', 'Template Surat Pendukung Penelitian', 'RESEARCH INNOVATION AND SUSTAINABILITY
UNIVERSITAS MULTIMEDIA NUSANTARA

Nomor: {{letterNumber}}

Dengan ini menerangkan bahwa {{applicantName}} ({{applicantIdentifier}}) dari {{studyProgram}} sedang melaksanakan penelitian "{{researchTitle}}" pada skema {{researchScheme}}.

{{customFields}}

Demikian surat ini diterbitkan untuk dipergunakan sebagaimana mestinya.', '3b35bd0a-39f9-5ff0-b419-f46cc0dee60e', '2026-07-27T04:00:00.000Z'),
  ('170ad1ac-5371-5663-8c15-a92bd65853c2', 'c1e5579f-a4f3-5725-b468-1543fc075cbb', 'Template Surat Keterangan Uji Lapangan', 'RESEARCH INNOVATION AND SUSTAINABILITY
UNIVERSITAS MULTIMEDIA NUSANTARA

Nomor: {{letterNumber}}

Dengan ini menerangkan bahwa {{applicantName}} ({{applicantIdentifier}}) dari {{studyProgram}} sedang melaksanakan penelitian "{{researchTitle}}" pada skema {{researchScheme}}.

{{customFields}}

Demikian surat ini diterbitkan untuk dipergunakan sebagaimana mestinya.', '3b35bd0a-39f9-5ff0-b419-f46cc0dee60e', '2026-07-29T05:00:00.000Z'),
  ('10e1ecb9-0d3c-5458-ac59-5e544dd924f8', 'cc9e3bc7-36e3-57cb-a823-bf40d2b9a3e3', 'Template Surat Pendukung Penelitian', 'RESEARCH INNOVATION AND SUSTAINABILITY
UNIVERSITAS MULTIMEDIA NUSANTARA

Nomor: {{letterNumber}}

Dengan ini menerangkan bahwa {{applicantName}} ({{applicantIdentifier}}) dari {{studyProgram}} sedang melaksanakan penelitian "{{researchTitle}}" pada skema {{researchScheme}}.

{{customFields}}

Demikian surat ini diterbitkan untuk dipergunakan sebagaimana mestinya.', '3b35bd0a-39f9-5ff0-b419-f46cc0dee60e', '2026-08-01T04:00:00.000Z');

INSERT INTO letter_request_fields (id, template_id, field_key, field_label, field_type, is_required, placeholder, help_text, options, position) VALUES
  ('bd571a74-e66d-5f99-a25b-7cc00f7b6d09', '3e0e650a-0951-51bd-bcc2-f2d98413ab3d', 'recipientInstitution', 'Instansi Tujuan', 'text', TRUE, 'Nama instansi tujuan', '', '[]'::jsonb, 1),
  ('0f169618-35f6-56d2-8215-36534282210a', '3e0e650a-0951-51bd-bcc2-f2d98413ab3d', 'activityPurpose', 'Tujuan Kegiatan', 'textarea', TRUE, 'Jelaskan tujuan penggunaan surat', '', '[]'::jsonb, 2),
  ('1f526a62-8ef5-52ae-a4d6-2ae8fe117357', '3e0e650a-0951-51bd-bcc2-f2d98413ab3d', 'activityDate', 'Tanggal Kegiatan', 'date', TRUE, '', '', '[]'::jsonb, 3),
  ('37fb3a39-62c8-5e6a-bd42-51b207f0b306', '8dc535ce-f664-5821-aabc-bce7e96be920', 'recipientInstitution', 'Instansi Tujuan', 'text', TRUE, 'Nama instansi tujuan', '', '[]'::jsonb, 1),
  ('cf91cd92-3758-5af4-ae08-bdfd8415ff18', '8dc535ce-f664-5821-aabc-bce7e96be920', 'activityPurpose', 'Tujuan Kegiatan', 'textarea', TRUE, 'Jelaskan tujuan penggunaan surat', '', '[]'::jsonb, 2),
  ('82d0329b-1ac9-5ef7-b4f5-94e29a35983f', '8dc535ce-f664-5821-aabc-bce7e96be920', 'activityDate', 'Tanggal Kegiatan', 'date', TRUE, '', '', '[]'::jsonb, 3),
  ('3de9d897-b76a-5715-8893-2c80cb39de34', '170ad1ac-5371-5663-8c15-a92bd65853c2', 'recipientInstitution', 'Instansi Tujuan', 'text', TRUE, 'Nama instansi tujuan', '', '[]'::jsonb, 1),
  ('8c4a120b-c827-5552-aa76-05b42d2c7964', '170ad1ac-5371-5663-8c15-a92bd65853c2', 'activityPurpose', 'Tujuan Kegiatan', 'textarea', TRUE, 'Jelaskan tujuan penggunaan surat', '', '[]'::jsonb, 2),
  ('3bed9a0d-6c2a-56cc-a6e7-9e965edcbf1f', '170ad1ac-5371-5663-8c15-a92bd65853c2', 'activityDate', 'Tanggal Kegiatan', 'date', TRUE, '', '', '[]'::jsonb, 3),
  ('26a51e5f-4836-534e-bf39-4e8315447ff6', '10e1ecb9-0d3c-5458-ac59-5e544dd924f8', 'recipientInstitution', 'Instansi Tujuan', 'text', TRUE, 'Nama instansi tujuan', '', '[]'::jsonb, 1),
  ('8a6433aa-bcba-57c9-a810-d429b5a1de09', '10e1ecb9-0d3c-5458-ac59-5e544dd924f8', 'activityPurpose', 'Tujuan Kegiatan', 'textarea', TRUE, 'Jelaskan tujuan penggunaan surat', '', '[]'::jsonb, 2),
  ('4103d92d-6c89-55d3-a39e-4714671efa5b', '10e1ecb9-0d3c-5458-ac59-5e544dd924f8', 'activityDate', 'Tanggal Kegiatan', 'date', TRUE, '', '', '[]'::jsonb, 3);

INSERT INTO letter_request_values (id, letter_id, template_id, field_id, field_value, submitted_by, submitted_at) VALUES
  ('8b31cbd5-c6c1-5bdb-a55d-2ec1fad01a38', '7eceb1cf-bd95-5dcb-b00c-0f0e22a1d9cc', '8dc535ce-f664-5821-aabc-bce7e96be920', '37fb3a39-62c8-5e6a-bd42-51b207f0b306', '"Dinas Komunikasi dan Informatika Kota Tangerang"'::jsonb, '7e8badc6-2777-5e2a-9c06-8a122d9a7f5b', '2026-07-27T04:00:00.000Z'),
  ('0050d253-d1dc-5741-8244-2ac8dd8fb8a8', '7eceb1cf-bd95-5dcb-b00c-0f0e22a1d9cc', '8dc535ce-f664-5821-aabc-bce7e96be920', 'cf91cd92-3758-5af4-ae08-bdfd8415ff18', '"Permohonan akses data terbatas untuk validasi metadata repositori penelitian."'::jsonb, '7e8badc6-2777-5e2a-9c06-8a122d9a7f5b', '2026-07-27T04:00:00.000Z'),
  ('632996ce-f2e3-50e1-8dce-edc3480d8a9a', '7eceb1cf-bd95-5dcb-b00c-0f0e22a1d9cc', '8dc535ce-f664-5821-aabc-bce7e96be920', '82d0329b-1ac9-5ef7-b4f5-94e29a35983f', '"2026-09-10"'::jsonb, '7e8badc6-2777-5e2a-9c06-8a122d9a7f5b', '2026-07-27T04:00:00.000Z'),
  ('69c373a5-e0a6-5142-b5e3-d1a878c3b5f5', 'c1e5579f-a4f3-5725-b468-1543fc075cbb', '170ad1ac-5371-5663-8c15-a92bd65853c2', '3de9d897-b76a-5715-8893-2c80cb39de34', '"PT Data Nusantara"'::jsonb, '7e8badc6-2777-5e2a-9c06-8a122d9a7f5b', '2026-07-29T05:00:00.000Z'),
  ('e445319a-bdf3-5547-a779-b15013f1500d', 'c1e5579f-a4f3-5725-b468-1543fc075cbb', '170ad1ac-5371-5663-8c15-a92bd65853c2', '8c4a120b-c827-5552-aa76-05b42d2c7964', '""'::jsonb, '7e8badc6-2777-5e2a-9c06-8a122d9a7f5b', '2026-07-29T05:00:00.000Z'),
  ('9afbed33-a847-59ce-bd2f-ab0b4925146d', 'c1e5579f-a4f3-5725-b468-1543fc075cbb', '170ad1ac-5371-5663-8c15-a92bd65853c2', '3bed9a0d-6c2a-56cc-a6e7-9e965edcbf1f', '"2026-09-18"'::jsonb, '7e8badc6-2777-5e2a-9c06-8a122d9a7f5b', '2026-07-29T05:00:00.000Z'),
  ('540a3648-a30c-5935-9d24-e49f2b1ad5c2', 'cc9e3bc7-36e3-57cb-a823-bf40d2b9a3e3', '10e1ecb9-0d3c-5458-ac59-5e544dd924f8', '26a51e5f-4836-534e-bf39-4e8315447ff6', '"LPPM Universitas Multimedia Nusantara"'::jsonb, '7e8badc6-2777-5e2a-9c06-8a122d9a7f5b', '2026-08-01T04:00:00.000Z'),
  ('99edb1c1-a605-5555-8ee9-69177de1b2ad', 'cc9e3bc7-36e3-57cb-a823-bf40d2b9a3e3', '10e1ecb9-0d3c-5458-ac59-5e544dd924f8', '8a6433aa-bcba-57c9-a810-d429b5a1de09', '"Pelaksanaan penelitian internal tahun 2026."'::jsonb, '7e8badc6-2777-5e2a-9c06-8a122d9a7f5b', '2026-08-01T04:00:00.000Z'),
  ('1cc45045-b688-5529-bf0c-79ecc38c7eb5', 'cc9e3bc7-36e3-57cb-a823-bf40d2b9a3e3', '10e1ecb9-0d3c-5458-ac59-5e544dd924f8', '4103d92d-6c89-55d3-a39e-4714671efa5b', '"2026-08-15"'::jsonb, '7e8badc6-2777-5e2a-9c06-8a122d9a7f5b', '2026-08-01T04:00:00.000Z');

INSERT INTO generated_letters (id, letter_id, letter_number, file_name, file_url, content_snapshot, generated_by, generated_at) VALUES
  ('4d663eee-a459-52de-bb1c-c13e5de573e5', 'cc9e3bc7-36e3-57cb-a823-bf40d2b9a3e3', '0001/ST-RIS/LPPM/08/2026', '0001-ST-RIS-LPPM-08-2026.txt', 'archive://letter-generated-1', 'RESEARCH INNOVATION AND SUSTAINABILITY
UNIVERSITAS MULTIMEDIA NUSANTARA

Nomor: 0001/ST-RIS/LPPM/08/2026

Dr. Budi Santoso ditugaskan melaksanakan penelitian Pengembangan Repositori Riset Terintegrasi.

Surat final demo.', '3b35bd0a-39f9-5ff0-b419-f46cc0dee60e', '2026-08-01T04:00:00.000Z');

INSERT INTO letter_status_history (id, letter_id, old_status, new_status, note, changed_by, changed_at) VALUES
  ('f72c8728-adec-5c02-a25f-4a632b4b879c', 'f3fc2961-cfa0-5177-82de-eba46a3bce3b', NULL, 'submitted', 'Permintaan surat wawancara dikirim untuk diverifikasi.', '7e8badc6-2777-5e2a-9c06-8a122d9a7f5b', '2026-07-20T02:05:00.000Z'),
  ('f0a77e99-730f-5108-a4bf-0596ee7d5357', 'fa87951c-2d70-503a-a6c4-4277b5c5166f', NULL, 'submitted', 'Permintaan surat perjalanan dikirim.', '7e8badc6-2777-5e2a-9c06-8a122d9a7f5b', '2026-07-21T02:00:00.000Z'),
  ('37c75ca0-a268-5cd6-a4d7-82824c16ed3d', 'fa87951c-2d70-503a-a6c4-4277b5c5166f', 'submitted', 'form_design', 'Permintaan diterima. Admin sedang menyusun form.', '3b35bd0a-39f9-5ff0-b419-f46cc0dee60e', '2026-07-22T03:00:00.000Z'),
  ('c20df229-a251-584f-b9a3-8dc9c4473d79', '7fabf43f-0cd9-5096-a4e4-dcbb3136fc9c', NULL, 'submitted', 'Permintaan klirens etik dikirim.', '7e8badc6-2777-5e2a-9c06-8a122d9a7f5b', '2026-07-23T02:00:00.000Z'),
  ('6fcbec90-c927-5582-809b-4c7b1a3be8c0', '7fabf43f-0cd9-5096-a4e4-dcbb3136fc9c', 'submitted', 'form_design', 'Permintaan diterima.', '3b35bd0a-39f9-5ff0-b419-f46cc0dee60e', '2026-07-23T06:00:00.000Z'),
  ('ff09243e-2f07-548e-bbfd-0ef3ba4a0e15', '7fabf43f-0cd9-5096-a4e4-dcbb3136fc9c', 'form_design', 'data_required', 'Form telah disiapkan dan menunggu data lecturer.', '3b35bd0a-39f9-5ff0-b419-f46cc0dee60e', '2026-07-24T04:00:00.000Z'),
  ('b71bf20a-de97-5cb5-9061-c8d31f44129f', '7eceb1cf-bd95-5dcb-b00c-0f0e22a1d9cc', NULL, 'submitted', 'Permintaan surat izin penelitian dikirim.', '7e8badc6-2777-5e2a-9c06-8a122d9a7f5b', '2026-07-25T02:00:00.000Z'),
  ('2b46a069-a2f0-5b80-bf51-76dfc0876ef2', '7eceb1cf-bd95-5dcb-b00c-0f0e22a1d9cc', 'submitted', 'form_design', 'Permintaan diterima.', '3b35bd0a-39f9-5ff0-b419-f46cc0dee60e', '2026-07-25T06:00:00.000Z'),
  ('3eae2b0b-5da5-59b3-af58-05a8f289dbad', '7eceb1cf-bd95-5dcb-b00c-0f0e22a1d9cc', 'form_design', 'data_required', 'Form dikirim ke lecturer.', '3b35bd0a-39f9-5ff0-b419-f46cc0dee60e', '2026-07-26T03:00:00.000Z'),
  ('e11d22c8-7793-5ff1-8312-c7bdbac2ff7b', '7eceb1cf-bd95-5dcb-b00c-0f0e22a1d9cc', 'data_required', 'data_submitted', 'Data dilengkapi dan menunggu verifikasi final.', '7e8badc6-2777-5e2a-9c06-8a122d9a7f5b', '2026-07-27T04:00:00.000Z'),
  ('10f5973f-8111-5def-895a-3d5641cbf035', 'c1e5579f-a4f3-5725-b468-1543fc075cbb', NULL, 'submitted', 'Permintaan surat custom dikirim.', '7e8badc6-2777-5e2a-9c06-8a122d9a7f5b', '2026-07-27T02:00:00.000Z'),
  ('3d809ab5-1b56-568b-bc30-c387d921b8da', 'c1e5579f-a4f3-5725-b468-1543fc075cbb', 'submitted', 'form_design', 'Permintaan diterima.', '3b35bd0a-39f9-5ff0-b419-f46cc0dee60e', '2026-07-27T06:00:00.000Z'),
  ('6fd18b6b-ef0c-5db0-aff7-6967f448a984', 'c1e5579f-a4f3-5725-b468-1543fc075cbb', 'form_design', 'data_required', 'Form dikirim ke lecturer.', '3b35bd0a-39f9-5ff0-b419-f46cc0dee60e', '2026-07-28T03:00:00.000Z'),
  ('447f2c1c-3b6e-5959-87ab-e81b302bc831', 'c1e5579f-a4f3-5725-b468-1543fc075cbb', 'data_required', 'data_submitted', 'Data dikirim untuk verifikasi.', '7e8badc6-2777-5e2a-9c06-8a122d9a7f5b', '2026-07-29T03:00:00.000Z'),
  ('51efbbaa-9fae-54ae-bfc1-40a8074b3242', 'c1e5579f-a4f3-5725-b468-1543fc075cbb', 'data_submitted', 'revision_required', 'Tujuan kegiatan perlu dilengkapi.', '3b35bd0a-39f9-5ff0-b419-f46cc0dee60e', '2026-07-29T05:00:00.000Z'),
  ('e174f66b-5469-5557-93c5-111046bae43d', 'aee91c27-740e-5a33-a413-6ee09b8fd8e1', NULL, 'submitted', 'Permintaan surat kegiatan lain dikirim.', '7e8badc6-2777-5e2a-9c06-8a122d9a7f5b', '2026-07-30T02:00:00.000Z'),
  ('fee0b9cd-ff8d-5cba-a06f-c0f3c8748493', 'aee91c27-740e-5a33-a413-6ee09b8fd8e1', 'submitted', 'rejected', 'Kebutuhan surat berada di luar lingkup penelitian yang didanai.', '3b35bd0a-39f9-5ff0-b419-f46cc0dee60e', '2026-07-30T05:00:00.000Z'),
  ('8383ac2d-0b0b-5dc5-be87-8bd296417a5c', 'cc9e3bc7-36e3-57cb-a823-bf40d2b9a3e3', NULL, 'submitted', 'Permintaan surat tugas dikirim.', '7e8badc6-2777-5e2a-9c06-8a122d9a7f5b', '2026-07-28T02:00:00.000Z'),
  ('d430c859-1dd1-5b67-9369-94a320293995', 'cc9e3bc7-36e3-57cb-a823-bf40d2b9a3e3', 'submitted', 'form_design', 'Permintaan diterima.', '3b35bd0a-39f9-5ff0-b419-f46cc0dee60e', '2026-07-28T06:00:00.000Z'),
  ('f07a3bc8-2963-59b4-956f-58ef4b29f40e', 'cc9e3bc7-36e3-57cb-a823-bf40d2b9a3e3', 'form_design', 'data_required', 'Form dikirim ke lecturer.', '3b35bd0a-39f9-5ff0-b419-f46cc0dee60e', '2026-07-29T03:00:00.000Z'),
  ('d020a3e7-6699-51bb-985d-6a39d7120041', 'cc9e3bc7-36e3-57cb-a823-bf40d2b9a3e3', 'data_required', 'data_submitted', 'Data dikirim untuk verifikasi.', '7e8badc6-2777-5e2a-9c06-8a122d9a7f5b', '2026-07-30T03:00:00.000Z'),
  ('58e724f6-3b3b-5048-b65d-1069553b6f50', 'cc9e3bc7-36e3-57cb-a823-bf40d2b9a3e3', 'data_submitted', 'generated', 'Surat final diterbitkan.', '3b35bd0a-39f9-5ff0-b419-f46cc0dee60e', '2026-08-01T04:00:00.000Z');

INSERT INTO external_research (id, user_id, created_by, activity_name, research_title, activity_year, activity_status, activity_type, role_in_research, organizer_origin, funding_source, funding_amount, currency, submission_status, category, metadata, type_detail, submitted_at, validated_at, archived_at, created_at, updated_at) VALUES
  ('aa3d7114-9b06-5539-a231-65c6a4a39ae5', '7e8badc6-2777-5e2a-9c06-8a122d9a7f5b', '7e8badc6-2777-5e2a-9c06-8a122d9a7f5b', 'Hibah Riset Terapan Kemdikbud 2026', 'Model Analitik Prediksi Keberhasilan Studi Mahasiswa', 2026, 'ongoing', 'external', 'ketua', 'Kemdikbudristek', 'DRTPM', 150000000, 'IDR', 'submitted', 'grant', '{"ripRelation":"ICT-Based","tktTarget":5,"sdgInvolvement":true,"integrationToTeaching":true,"courseName":"Data Mining","academicYear":"2026/2027"}'::jsonb, '{"grantType":"nasional","grantName":"Hibah Riset Terapan","grantLink":"https://example.test/hibah","researchStatus":"ongoing","fundingAmount":150000000}'::jsonb, '2026-06-03T02:10:00.000Z', NULL, NULL, '2026-06-02T02:00:00.000Z', '2026-06-03T02:10:00.000Z'),
  ('a2a65166-b22d-57af-981e-f99428b60077', '7e8badc6-2777-5e2a-9c06-8a122d9a7f5b', '7e8badc6-2777-5e2a-9c06-8a122d9a7f5b', 'Penelitian Mandiri PRO-STEP', 'Pengembangan Prototipe Sistem Informasi Riset Terintegrasi', 2025, 'completed', 'mandiri', 'ketua', 'Mandiri', 'Mandiri', 25000000, 'IDR', 'validated', 'independent', '{"ripRelation":"ICT-Based","tktTarget":6,"sdgInvolvement":true,"integrationToTeaching":false,"courseName":"","academicYear":""}'::jsonb, '{"independentType":"prostep"}'::jsonb, '2025-12-12T02:00:00.000Z', '2025-12-15T02:00:00.000Z', NULL, '2025-11-03T02:00:00.000Z', '2025-12-15T02:00:00.000Z');

INSERT INTO external_research_sdgs (external_research_id, sdg_id) VALUES
  ('aa3d7114-9b06-5539-a231-65c6a4a39ae5', 4),
  ('aa3d7114-9b06-5539-a231-65c6a4a39ae5', 9),
  ('a2a65166-b22d-57af-981e-f99428b60077', 4),
  ('a2a65166-b22d-57af-981e-f99428b60077', 9);

INSERT INTO external_research_outputs (id, external_research_id, output_type, title, year, description, link, position) VALUES
  ('dea21369-362b-5758-839b-812c3c5ed44e', 'aa3d7114-9b06-5539-a231-65c6a4a39ae5', 'journal', 'Predictive Analytics for Student Success', 2026, 'Artikel jurnal terkait model prediksi.', '', 1),
  ('243277ea-90c7-5094-ad19-0cb8913399ec', 'aa3d7114-9b06-5539-a231-65c6a4a39ae5', 'prototype', 'Dashboard Prediksi Akademik', 2026, 'Prototype dashboard analitik.', '', 2),
  ('afc450f1-c782-5d3b-a5eb-14c2ea2aabf9', 'a2a65166-b22d-57af-981e-f99428b60077', 'prototype', 'Prototype RIS', 2025, 'Prototype dashboard RIS.', 'https://example.test/prototype', 1);

INSERT INTO external_research_files (id, external_research_id, file_type, file_id, uploaded_by, uploaded_at) VALUES
  ('47fbc19f-5903-5349-8c65-da287053c421', 'aa3d7114-9b06-5539-a231-65c6a4a39ae5', 'proposal', '0c77760e-6b70-5377-834e-96804fb302c6', '7e8badc6-2777-5e2a-9c06-8a122d9a7f5b', '2026-06-03T02:00:00.000Z'),
  ('feece059-08ce-52f0-9d3c-81338aaed55b', 'aa3d7114-9b06-5539-a231-65c6a4a39ae5', 'budget_plan', 'ea767457-59f2-502e-8331-3a74d92ac0fd', '7e8badc6-2777-5e2a-9c06-8a122d9a7f5b', '2026-06-03T02:00:00.000Z'),
  ('15b4c869-0036-5a0e-a35d-8c82f57a6300', 'aa3d7114-9b06-5539-a231-65c6a4a39ae5', 'contract', '16f6feba-9cfe-5306-ae8c-3c915cf38ef3', '7e8badc6-2777-5e2a-9c06-8a122d9a7f5b', '2026-06-03T02:00:00.000Z'),
  ('4c445584-d69f-51b1-ac45-1e6dc42541cd', 'aa3d7114-9b06-5539-a231-65c6a4a39ae5', 'integration_proof', 'a8c2ee44-88bf-5b57-bebe-7cf88c1a8afe', '7e8badc6-2777-5e2a-9c06-8a122d9a7f5b', '2026-06-02T02:00:00.000Z'),
  ('d835186f-1f7c-586d-abd5-0abac2f7fa90', 'a2a65166-b22d-57af-981e-f99428b60077', 'proposal', '54f69df9-c114-5fe5-97aa-b87c59410e07', '7e8badc6-2777-5e2a-9c06-8a122d9a7f5b', '2025-11-03T02:00:00.000Z'),
  ('5f910714-98ad-57e2-b7a6-b19ba78dfe2d', 'a2a65166-b22d-57af-981e-f99428b60077', 'budget_plan', '3d184e98-41f8-527a-98df-ac303e43272b', '7e8badc6-2777-5e2a-9c06-8a122d9a7f5b', '2025-11-03T02:00:00.000Z'),
  ('5502476e-79ed-5e77-ada3-ac3347cf5655', 'a2a65166-b22d-57af-981e-f99428b60077', 'contract', '8b389b0d-c945-53b7-ac21-748d959efb97', '7e8badc6-2777-5e2a-9c06-8a122d9a7f5b', '2025-11-03T02:00:00.000Z'),
  ('a0dbd32e-6cf8-520e-b95c-c4f74dc20d7a', 'a2a65166-b22d-57af-981e-f99428b60077', 'final_report', '43b304a7-b788-5e8d-baac-d1f1b972f1ff', '7e8badc6-2777-5e2a-9c06-8a122d9a7f5b', '2025-12-12T02:00:00.000Z');

INSERT INTO external_research_reviews (id, external_research_id, reviewer_id, decision, notes, checklist, reviewed_at) VALUES
  ('abf2a7ce-280c-5adc-8d8a-c83f52611810', 'a2a65166-b22d-57af-981e-f99428b60077', 'a578e542-9765-56f2-9e76-11ea5ba7fa89', 'validated', 'Laporan dan dokumen lengkap.', '{"fieldComplete":true,"documentsComplete":true,"documentsValid":true,"notDuplicate":true,"statusConsistent":true}'::jsonb, '2025-12-15T02:00:00.000Z');

INSERT INTO external_research_history (id, external_research_id, old_status, new_status, note, changed_by, changed_at) VALUES
  ('2b4c95e4-9045-537b-a205-f67469736ad6', 'aa3d7114-9b06-5539-a231-65c6a4a39ae5', NULL, 'draft', 'Draft laporan dibuat.', '7e8badc6-2777-5e2a-9c06-8a122d9a7f5b', '2026-06-02T02:00:00.000Z'),
  ('d732de8c-d9c9-5773-9fb7-37b5e1cdf2a7', 'aa3d7114-9b06-5539-a231-65c6a4a39ae5', 'draft', 'submitted', 'Laporan disubmit ke LPPM.', '7e8badc6-2777-5e2a-9c06-8a122d9a7f5b', '2026-06-03T02:10:00.000Z'),
  ('15dbfe8b-2772-57d9-82b1-8f5e59853345', 'a2a65166-b22d-57af-981e-f99428b60077', NULL, 'draft', 'Draft laporan dibuat.', '7e8badc6-2777-5e2a-9c06-8a122d9a7f5b', '2025-11-03T02:00:00.000Z'),
  ('b6fe3ce2-f087-5f5f-af1a-85a8a5658b07', 'a2a65166-b22d-57af-981e-f99428b60077', 'draft', 'submitted', 'Laporan disubmit ke LPPM.', '7e8badc6-2777-5e2a-9c06-8a122d9a7f5b', '2025-12-12T02:00:00.000Z'),
  ('bce1be86-91d4-5361-8983-9b3219203332', 'a2a65166-b22d-57af-981e-f99428b60077', 'submitted', 'validated', 'Laporan divalidasi LPPM.', 'a578e542-9765-56f2-9e76-11ea5ba7fa89', '2025-12-15T02:00:00.000Z');

INSERT INTO system_activity_logs (id, user_id, action, entity_type, entity_id, old_data, new_data, created_at) VALUES
  ('84f03b37-fedd-5272-833f-953e2dce216e', '97cf25f2-d2a0-51df-ac14-c93e42fc7e4f', 'verify_profile', 'researcher_profile', '1a826f2d-8c7e-52ca-abfc-8ae75f1cb6c4', '{"verificationStatus":"pending"}'::jsonb, '{"verificationStatus":"verified"}'::jsonb, '2026-06-05T03:00:00.000Z');
-- END SEED A

-- BEGIN SEED B: CLEAN DEPLOYMENT (COMMENTED)
-- Replace Seed A above with this block (uncomment it), before the final COMMIT.
-- Only Super Admin/Manager accounts and their profiles, lookup data and the
-- master letter template are created. No demo schemes/proposals/reports/mail.
-- Replace CHANGE_BEFORE_DEPLOY passwords; never commit real credentials.
-- INSERT INTO roles (code, name) VALUES
--   ('super_admin', 'Super Admin'),
--   ('manager', 'Manager LPPM'),
--   ('admin', 'Admin'),
--   ('lecturer', 'Dosen');
--
-- INSERT INTO admin_scopes (code, name) VALUES
--   ('research_management', 'Manajemen Penelitian'),
--   ('letter_management', 'Pengajuan Surat'),
--   ('researcher_profile_management', 'Informasi Peneliti');
--
-- INSERT INTO sdg_goals (id, name) VALUES
--   (1, 'No Poverty'),
--   (2, 'Zero Hunger'),
--   (3, 'Good Health and Well-being'),
--   (4, 'Quality Education'),
--   (5, 'Gender Equality'),
--   (6, 'Clean Water and Sanitation'),
--   (7, 'Affordable and Clean Energy'),
--   (8, 'Decent Work and Economic Growth'),
--   (9, 'Industry, Innovation and Infrastructure'),
--   (10, 'Reduced Inequalities'),
--   (11, 'Sustainable Cities and Communities'),
--   (12, 'Responsible Consumption and Production'),
--   (13, 'Climate Action'),
--   (14, 'Life Below Water'),
--   (15, 'Life on Land'),
--   (16, 'Peace, Justice and Strong Institutions'),
--   (17, 'Partnerships for the Goals');
--
-- INSERT INTO budget_categories (code, name, position) VALUES
--   ('materials', 'Bahan dan Peralatan', 1),
--   ('field', 'Pengumpulan Data', 2),
--   ('analysis', 'Analisis Data', 3),
--   ('reporting', 'Pelaporan Hasil Penelitian dan Luaran Wajib', 4);
--
-- INSERT INTO review_criteria (code, name, category, weight, position) VALUES
--   ('kejelasan_masalah', 'Kejelasan masalah (1-100)', 'Kualitas Proposal (30%)', 10, 1),
--   ('kebaruan_penelitian', 'Kebaruan penelitian (1-100)', 'Kualitas Proposal (30%)', 10, 2),
--   ('metodologi', 'Metodologi (1-100)', 'Kualitas Proposal (30%)', 10, 3),
--   ('kompetensi_ketua', 'Kompetensi ketua', 'Kelayakan Tim (15%)', 8, 4),
--   ('komposisi_tim', 'Komposisi tim', 'Kelayakan Tim (15%)', 7, 5),
--   ('kesesuaian_luaran', 'Kesesuaian Luaran Wajib', 'Luaran Penelitian (20%)', 10, 6),
--   ('realisme_target', 'Realisme Target', 'Luaran Penelitian (20%)', 10, 7),
--   ('kewajaran_biaya', 'Kewajaran Biaya', 'Anggaran (20%)', 10, 8),
--   ('kesesuaian_kegiatan', 'Kesesuaian dengan Kegiatan', 'Anggaran (20%)', 10, 9),
--   ('rip', 'RIP', 'Kesesuaian Strategis (15%)', 5, 10),
--   ('sdg', 'SDG', 'Kesesuaian Strategis (15%)', 5, 11),
--   ('research_center', 'Research Center', 'Kesesuaian Strategis (15%)', 5, 12);
--
-- INSERT INTO users (id, email, password_hash, name, role, is_active, applicant_enabled, default_mode, identifier, created_at, updated_at) VALUES
--   ('50dee293-899a-5d23-aaa3-0eccc771558e', 'superadmin@umn.ac.id', crypt('CHANGE_BEFORE_DEPLOY_SUPER_ADMIN', gen_salt('bf', 12)), 'Super Admin RIS', 'super_admin', TRUE, FALSE, 'management', NULL, '2026-06-01T00:00:00.000Z', '2026-06-01T00:00:00.000Z'),
--   ('9263f343-101a-5c74-8740-ad6e2958cd84', 'manager@umn.ac.id', crypt('CHANGE_BEFORE_DEPLOY_MANAGER', gen_salt('bf', 12)), 'Manager LPPM', 'manager', TRUE, TRUE, 'management', NULL, '2026-06-01T00:00:00.000Z', '2026-06-01T00:00:00.000Z');
--
-- INSERT INTO researcher_profiles (id, user_id, full_name, front_title, back_title, nidn, nik, nip, birth_place, birth_date, gender, nationality, institution_email, alternate_email, phone_number, domicile_address, correspondence_address, faculty, study_program, unit, position, functional_position, education_level, employment_status, orcid, google_scholar, sinta_id, bank_name, bank_account_number, bank_account_name, emergency_contact_name, emergency_contact_relation, emergency_contact_phone, sinta_score, research_count, last_research_year, profile_status, verification_status, completeness, last_updated_by, created_at, updated_at) VALUES
--   ('899e9275-9164-58dc-8388-7146167118ac', '9263f343-101a-5c74-8740-ad6e2958cd84', 'Kepala LPPM', NULL, NULL, 'MGR-LPPM-001', '3671010101880006', 'MGR001', 'Tangerang', '1988-01-01', 'Laki-laki', 'Indonesia', 'manager@umn.ac.id', NULL, '081200000002', 'Tangerang', 'Universitas Multimedia Nusantara', 'LPPM', 'Manajemen Riset', 'LPPM', 'Kepala LPPM', 'Manager', 'S3', 'fulltime', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, 0, 2026, 'active', 'verified', 85, '9263f343-101a-5c74-8740-ad6e2958cd84', '2026-06-01T03:00:00.000Z', '2026-06-01T03:00:00.000Z'),
--   ('25ef7d31-f651-54fc-a60d-ce1526ff5599', '50dee293-899a-5d23-aaa3-0eccc771558e', 'Super Admin RIS', NULL, NULL, 'SADM-RIS-001', NULL, 'SADM001', NULL, NULL, NULL, 'Indonesia', 'superadmin@umn.ac.id', NULL, NULL, NULL, 'Universitas Multimedia Nusantara', 'LPPM', 'Manajemen Sistem Riset', 'LPPM', 'Super Admin', 'Super Administrator', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, 0, NULL, 'active', 'verified', 51, '50dee293-899a-5d23-aaa3-0eccc771558e', '2026-06-01T03:00:00.000Z', '2026-06-01T03:00:00.000Z');
--
-- INSERT INTO researcher_expertise (id, name) VALUES
--   ('c8735af1-e049-5091-a3e8-7ce31a74cc7e', 'Artificial Intelligence'),
--   ('1dfeb217-0c68-52bf-8cbe-3ab3f9401578', 'Machine Learning'),
--   ('bc66a21a-c5fe-593a-9032-4f717c1b08cf', 'Computer Vision'),
--   ('42e1923a-4a71-5c98-a4e0-de101c2cfce5', 'Sistem Informasi'),
--   ('62918cdc-5dc1-5f12-8675-defc0a5cc5d8', 'Data Science'),
--   ('dfa21cac-43a4-5cdc-a069-2ce9bc061618', 'Digital Business');
--
-- INSERT INTO letter_master_templates (id, name, version, template_content, fields) VALUES
--   (1, 'Master Template Surat', 1, 'UNIVERSITAS MULTIMEDIA NUSANTARA
--
-- Nomor: {{letterNumber}}
-- Perihal: {{letterPurpose}}
--
-- Nama: {{applicantName}}
-- NIDN/NIP: {{applicantIdentifier}}
-- Program Studi: {{studyProgram}}
-- Fakultas: {{faculty}}
--
-- {{customFields}}
--
-- Demikian surat ini diterbitkan untuk dipergunakan sebagaimana mestinya.', '[{"id":"master-recipient","key":"recipientInstitution","label":"Instansi atau Penerima Tujuan","type":"text","required":true,"options":[]},{"id":"master-activity","key":"activityName","label":"Nama Kegiatan","type":"text","required":true,"options":[]},{"id":"master-purpose","key":"activityPurpose","label":"Keperluan Surat","type":"textarea","required":true,"options":[]},{"id":"master-date","key":"activityDate","label":"Tanggal Kegiatan","type":"date","required":true,"options":[]},{"id":"master-location","key":"activityLocation","label":"Lokasi Kegiatan","type":"text","required":false,"options":[]},{"id":"master-notes","key":"additionalNotes","label":"Keterangan Tambahan","type":"textarea","required":false,"options":[]}]'::jsonb);
-- END SEED B

COMMIT;


