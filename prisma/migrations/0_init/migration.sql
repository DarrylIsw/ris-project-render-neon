-- Baseline for an empty PostgreSQL database. Existing ris_db is marked applied.
SET search_path TO public;
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
  worker_id varchar(120),
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
CREATE INDEX email_outbox_processing_lock_idx
  ON email_outbox (status, locked_at)
  WHERE status = 'processing';

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
CREATE UNIQUE INDEX funded_research_identity_unique ON funded_research (id, scheme_id, lead_user_id);
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
