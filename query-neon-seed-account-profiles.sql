-- RIS testing: account profile seed for Neon
--
-- Prerequisite: run database-seed.sql first so the seven users below exist.
-- This script deliberately does NOT change passwords or delete existing data.
-- It is idempotent: it can be run again to repair the account/profile seed.

BEGIN;

-- database-seed.sql predates the runtime-state migration in some copies of the
-- project.  Creating these two tables here makes this seed safe in either case.
CREATE TABLE IF NOT EXISTS public.ris_records (
  domain varchar(80) NOT NULL,
  entity_id varchar(180) NOT NULL,
  payload jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (domain, entity_id)
);

CREATE TABLE IF NOT EXISTS public.ris_revision (
  id integer PRIMARY KEY,
  version integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$
DECLARE
  expected_accounts integer := 7;
  found_accounts integer;
BEGIN
  SELECT count(*)
    INTO found_accounts
  FROM public.users
  WHERE lower(email) IN (
    'superadmin@umn.ac.id',
    'manager@umn.ac.id',
    'admin.penelitian@umn.ac.id',
    'admin.surat@umn.ac.id',
    'admin.profil@umn.ac.id',
    'lecturer@umn.ac.id',
    'reviewer@umn.ac.id'
  );

  IF found_accounts <> expected_accounts THEN
    RAISE EXCEPTION
      'Expected % RIS test accounts, but found %. Run database-seed.sql before this script.',
      expected_accounts,
      found_accounts;
  END IF;
END $$;

-- Physical profile rows used by reporting and relational server-side queries.
WITH profile_seed AS (
  SELECT *
  FROM (VALUES
    (
      'superadmin@umn.ac.id',
      '25ef7d31-f651-54fc-a60d-ce1526ff5599'::uuid,
      'Super Admin RIS', NULL::varchar, NULL::varchar, 'SADM-RIS-001', NULL::varchar,
      'SADM001', NULL::varchar, NULL::date, NULL::varchar, 'Indonesia',
      'superadmin@umn.ac.id', NULL::varchar, NULL::varchar, NULL::text, NULL::text,
      'LPPM', 'Manajemen Riset', 'LPPM', 'Super Admin', NULL::varchar,
      NULL::varchar, NULL::varchar, NULL::varchar, 'S1', 'fulltime',
      0, 0, NULL::integer, NULL::varchar, NULL::varchar, NULL::varchar,
      NULL::varchar, NULL::varchar, NULL::varchar, 'active', 'verified', 51
    ),
    (
      'manager@umn.ac.id',
      '899e9275-9164-58dc-8388-7146167118ac'::uuid,
      'Kepala LPPM', NULL::varchar, NULL::varchar, 'MGR-LPPM-001', '3671010101880006',
      'MGR001', 'Tangerang', DATE '1988-01-01', 'male', 'Indonesia',
      'manager@umn.ac.id', NULL::varchar, NULL::varchar, 'Tangerang', 'Universitas Multimedia Nusantara',
      'LPPM', 'Manajemen Riset', 'LPPM', 'Manajer', 'manager',
      NULL::varchar, NULL::varchar, NULL::varchar, 'S3', 'lektor_kepala',
      0, 0, 2026, NULL::varchar, NULL::varchar, NULL::varchar,
      NULL::varchar, NULL::varchar, NULL::varchar, 'active', 'verified', 85
    ),
    (
      'admin.penelitian@umn.ac.id',
      '77e9145a-670d-5e1f-a859-686038e12a87'::uuid,
      'Admin Penelitian', NULL::varchar, NULL::varchar, 'ADM-RIS-001', '3671010101900005',
      'ADM001', 'Tangerang', DATE '1990-01-01', 'male', 'Indonesia',
      'admin.penelitian@umn.ac.id', NULL::varchar, NULL::varchar, 'Tangerang', 'Universitas Multimedia Nusantara',
      'LPPM', 'Manajemen Riset', 'LPPM', 'Administrator Penelitian', NULL::varchar,
      NULL::varchar, NULL::varchar, NULL::varchar, 'S1', 'fulltime',
      0, 0, NULL::integer, NULL::varchar, NULL::varchar, NULL::varchar,
      NULL::varchar, NULL::varchar, NULL::varchar, 'active', 'verified', 85
    ),
    (
      'admin.surat@umn.ac.id',
      '69b7d8c0-b8d3-51c9-aefb-182500d53c69'::uuid,
      'Admin Pengajuan Surat', NULL::varchar, NULL::varchar, 'ADM-SRT-001', NULL::varchar,
      'ADMSRT001', NULL::varchar, NULL::date, NULL::varchar, 'Indonesia',
      'admin.surat@umn.ac.id', NULL::varchar, NULL::varchar, NULL::text, NULL::text,
      'LPPM', 'Manajemen Riset', 'LPPM', 'Administrator Surat', NULL::varchar,
      NULL::varchar, NULL::varchar, NULL::varchar, 'S1', 'fulltime',
      0, 0, NULL::integer, NULL::varchar, NULL::varchar, NULL::varchar,
      NULL::varchar, NULL::varchar, NULL::varchar, 'active', 'verified', 51
    ),
    (
      'admin.profil@umn.ac.id',
      '8a24a802-b79a-5c5b-a45a-33c9671e2242'::uuid,
      'Admin Informasi Peneliti', NULL::varchar, NULL::varchar, 'ADM-PRF-001', NULL::varchar,
      'ADMPRF001', NULL::varchar, NULL::date, NULL::varchar, 'Indonesia',
      'admin.profil@umn.ac.id', NULL::varchar, NULL::varchar, NULL::text, NULL::text,
      'LPPM', 'Manajemen Riset', 'LPPM', 'Administrator Profil', NULL::varchar,
      NULL::varchar, NULL::varchar, NULL::varchar, 'S1', 'fulltime',
      0, 0, NULL::integer, NULL::varchar, NULL::varchar, NULL::varchar,
      NULL::varchar, NULL::varchar, NULL::varchar, 'active', 'verified', 51
    ),
    (
      'lecturer@umn.ac.id',
      '1a826f2d-8c7e-52ca-abfc-8ae75f1cb6c4'::uuid,
      'Budi Santoso', 'Dr.', NULL::varchar, '0312048501', '3671010101850001',
      '201203001', 'Jakarta', DATE '1985-12-04', 'male', 'Indonesia',
      'lecturer@umn.ac.id', 'budi.santoso@gmail.com', '081234567890', 'Tangerang', 'Universitas Multimedia Nusantara',
      'Fakultas Teknik dan Informatika', 'Sistem Informasi', 'Program Studi Sistem Informasi', 'Dosen', 'lektor',
      '0000-0002-1825-0097', 'https://scholar.google.com/citations?user=budi', '6723456', 'S3', 'fulltime',
      612, 14, 2026, 'Bank BCA', '1234567890', 'Budi Santoso',
      'Siti Santoso', 'Istri', '081298765432', 'active', 'verified', 100
    ),
    (
      'reviewer@umn.ac.id',
      '9d5ccc3c-ac0a-51df-b375-5fe8699dcaeb'::uuid,
      'Andini Prameswari', 'Dr.', NULL::varchar, '0308078602', '3671010807860002',
      '201108002', 'Bandung', DATE '1986-07-08', 'female', 'Indonesia',
      'reviewer@umn.ac.id', 'andini.prameswari@gmail.com', '081298765433', 'Tangerang', 'Universitas Multimedia Nusantara',
      'Fakultas Teknik dan Informatika', 'Sistem Informasi', 'Program Studi Sistem Informasi', 'Dosen', 'lektor_kepala',
      '0000-0003-1415-9265', 'https://scholar.google.com/citations?user=andini', '6789012', 'S3', 'homebase',
      780, 20, 2026, 'Bank Mandiri', '9876543210', 'Andini Prameswari',
      'Rudi Prameswara', 'Suami', '081298765434', 'active', 'verified', 100
    )
  ) AS seed(
    email, profile_id, full_name, front_title, back_title, nidn, nik, nip,
    birth_place, birth_date, gender, nationality, institution_email, alternate_email,
    phone_number, domicile_address, correspondence_address, faculty, study_program,
    unit, position, functional_position, orcid, google_scholar, sinta_id,
    education_level, employment_status, sinta_score, research_count, last_research_year,
    bank_name, bank_account_number, bank_account_name, emergency_contact_name,
    emergency_contact_relation, emergency_contact_phone, profile_status,
    verification_status, completeness
  )
), resolved AS (
  SELECT seed.*, users.id AS user_id
  FROM profile_seed AS seed
  JOIN public.users AS users ON lower(users.email) = lower(seed.email)
)
INSERT INTO public.researcher_profiles AS profile (
  id, user_id, full_name, front_title, back_title, nidn, nik, nip, birth_place,
  birth_date, gender, nationality, institution_email, alternate_email, phone_number,
  domicile_address, correspondence_address, faculty, study_program, unit, position,
  functional_position, orcid, google_scholar, sinta_id, education_level,
  employment_status, sinta_score, research_count, last_research_year, bank_name,
  bank_account_number, bank_account_name, emergency_contact_name,
  emergency_contact_relation, emergency_contact_phone, profile_status,
  verification_status, completeness, last_updated_by, version, updated_at
)
SELECT
  profile_id, user_id, full_name, front_title, back_title, nidn, nik, nip, birth_place,
  birth_date, gender, nationality, institution_email, alternate_email, phone_number,
  domicile_address, correspondence_address, faculty, study_program, unit, position,
  functional_position, orcid, google_scholar, sinta_id, education_level,
  employment_status, sinta_score, research_count, last_research_year, bank_name,
  bank_account_number, bank_account_name, emergency_contact_name,
  emergency_contact_relation, emergency_contact_phone,
  profile_status::public.profile_status_type,
  verification_status::public.verification_status_type,
  completeness, user_id, 1, now()
FROM resolved
ON CONFLICT (user_id) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  front_title = EXCLUDED.front_title,
  back_title = EXCLUDED.back_title,
  nidn = EXCLUDED.nidn,
  nik = EXCLUDED.nik,
  nip = EXCLUDED.nip,
  birth_place = EXCLUDED.birth_place,
  birth_date = EXCLUDED.birth_date,
  gender = EXCLUDED.gender,
  nationality = EXCLUDED.nationality,
  institution_email = EXCLUDED.institution_email,
  alternate_email = EXCLUDED.alternate_email,
  phone_number = EXCLUDED.phone_number,
  domicile_address = EXCLUDED.domicile_address,
  correspondence_address = EXCLUDED.correspondence_address,
  faculty = EXCLUDED.faculty,
  study_program = EXCLUDED.study_program,
  unit = EXCLUDED.unit,
  position = EXCLUDED.position,
  functional_position = EXCLUDED.functional_position,
  orcid = EXCLUDED.orcid,
  google_scholar = EXCLUDED.google_scholar,
  sinta_id = EXCLUDED.sinta_id,
  education_level = EXCLUDED.education_level,
  employment_status = EXCLUDED.employment_status,
  sinta_score = EXCLUDED.sinta_score,
  research_count = EXCLUDED.research_count,
  last_research_year = EXCLUDED.last_research_year,
  bank_name = EXCLUDED.bank_name,
  bank_account_number = EXCLUDED.bank_account_number,
  bank_account_name = EXCLUDED.bank_account_name,
  emergency_contact_name = EXCLUDED.emergency_contact_name,
  emergency_contact_relation = EXCLUDED.emergency_contact_relation,
  emergency_contact_phone = EXCLUDED.emergency_contact_phone,
  profile_status = EXCLUDED.profile_status,
  verification_status = EXCLUDED.verification_status,
  completeness = EXCLUDED.completeness,
  last_updated_by = EXCLUDED.last_updated_by,
  version = profile.version + 1,
  updated_at = now();

-- Administrative module scopes.
INSERT INTO public.user_admin_scopes (user_id, scope, assigned_by)
SELECT target.id, assignments.scope::public.admin_scope_type, manager.id
FROM (VALUES
  ('admin.penelitian@umn.ac.id', 'research_management'),
  ('admin.surat@umn.ac.id', 'letter_management'),
  ('admin.profil@umn.ac.id', 'researcher_profile_management')
) AS assignments(email, scope)
JOIN public.users AS target ON lower(target.email) = assignments.email
CROSS JOIN LATERAL (
  SELECT id FROM public.users WHERE lower(email) = 'manager@umn.ac.id'
) AS manager
ON CONFLICT (user_id, scope) DO NOTHING;

-- Physical applicant rows used by the proposal workflow.
INSERT INTO public.applicant_profiles AS applicant (
  id, user_id, name, identifier, applicant_role, applicant_kind, status,
  faculty, study_program, email, created_at, updated_at
)
SELECT
  values_seed.applicant_id::uuid,
  users.id,
  values_seed.name,
  values_seed.identifier,
  values_seed.applicant_role,
  'lecturer',
  values_seed.status,
  values_seed.faculty,
  values_seed.program,
  values_seed.email,
  now(),
  now()
FROM (VALUES
  ('04ce8cc9-e61e-505b-966c-706e78501a75', 'lecturer@umn.ac.id', 'Dr. Budi Santoso', '0312048501', 'Dosen', 'fulltime', 'Fakultas Teknik dan Informatika', 'Sistem Informasi'),
  ('d752c980-8f34-5913-9b5b-7e1f0d9a1d4c', 'reviewer@umn.ac.id', 'Dr. Andini Prameswari', '0308078602', 'Dosen', 'homebase', 'Fakultas Teknik dan Informatika', 'Sistem Informasi'),
  ('ccc8dc42-0de6-535c-a00d-7c5a33a1085b', 'manager@umn.ac.id', 'Kepala LPPM', 'MGR-LPPM-001', 'Manajer', 'fulltime', 'LPPM', 'Manajemen Riset')
) AS values_seed(applicant_id, email, name, identifier, applicant_role, status, faculty, program)
JOIN public.users AS users ON lower(users.email) = values_seed.email
ON CONFLICT (id) DO UPDATE SET
  user_id = EXCLUDED.user_id,
  name = EXCLUDED.name,
  identifier = EXCLUDED.identifier,
  applicant_role = EXCLUDED.applicant_role,
  applicant_kind = EXCLUDED.applicant_kind,
  status = EXCLUDED.status,
  faculty = EXCLUDED.faculty,
  study_program = EXCLUDED.study_program,
  email = EXCLUDED.email,
  updated_at = now();

-- Runtime state consumed by the existing application.  The relational tables above
-- are mirrors; without these records the profiles would not appear in the UI.
WITH system_users AS (
  SELECT * FROM (VALUES
    (0, 'user-super-admin', 'superadmin@umn.ac.id', 'Super Admin RIS', 'super_admin', false, 'management', NULL::varchar, 'super-admin-1', ARRAY[]::varchar[]),
    (1, 'user-manager', 'manager@umn.ac.id', 'Manager LPPM', 'manager', true, 'management', NULL::varchar, 'manager-1', ARRAY[]::varchar[]),
    (2, 'user-admin', 'admin.penelitian@umn.ac.id', 'Admin Penelitian', 'admin', false, 'management', NULL::varchar, 'admin-1', ARRAY['research_management']::varchar[]),
    (3, 'user-admin-letter', 'admin.surat@umn.ac.id', 'Admin Pengajuan Surat', 'admin', false, 'management', NULL::varchar, 'admin-letter-1', ARRAY['letter_management']::varchar[]),
    (4, 'user-admin-profile', 'admin.profil@umn.ac.id', 'Admin Informasi Peneliti', 'admin', false, 'management', NULL::varchar, 'admin-profile-1', ARRAY['researcher_profile_management']::varchar[]),
    (5, 'user-lecturer', 'lecturer@umn.ac.id', 'Dr. Budi Santoso', 'lecturer', true, 'lecturer', NULL::varchar, 'lecturer-1', ARRAY[]::varchar[]),
    (6, 'user-lecturer-2', 'reviewer@umn.ac.id', 'Dr. Andini Prameswari', 'lecturer', true, 'lecturer', NULL::varchar, 'lecturer-2', ARRAY[]::varchar[])
  ) AS seed(position, id, email, name, role, applicant_enabled, default_mode, identifier, profile_id, admin_scopes)
)
INSERT INTO public.ris_records AS record (domain, entity_id, payload, updated_at)
SELECT
  'systemUsers',
  id,
  jsonb_build_object(
    'position', position,
    'value', jsonb_build_object(
      'id', id, 'email', email, 'name', name, 'role', role,
      'isActive', true, 'applicantEnabled', applicant_enabled,
      'defaultMode', default_mode, 'identifier', identifier, 'profileId', profile_id,
      'adminScopes', to_jsonb(admin_scopes),
      'createdAt', '2026-06-01T00:00:00.000Z',
      'updatedAt', '2026-06-01T00:00:00.000Z'
    )
  ),
  now()
FROM system_users
ON CONFLICT (domain, entity_id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = now();

WITH profile_runtime AS (
  SELECT * FROM (VALUES
    (0, 'super-admin-1', 'user-super-admin', 'Super Admin RIS', NULL::varchar, NULL::varchar, 'SADM-RIS-001', NULL::varchar, NULL::varchar, NULL::varchar, NULL::varchar, NULL::varchar, 'Indonesia', 'superadmin@umn.ac.id', NULL::varchar, NULL::varchar, NULL::varchar, NULL::varchar, 'LPPM', 'Manajemen Riset', 'LPPM', 'Super Admin', NULL::varchar, NULL::varchar, NULL::varchar, NULL::varchar, NULL::varchar, NULL::varchar, NULL::varchar, NULL::varchar, NULL::varchar, NULL::varchar, NULL::varchar, NULL::varchar, NULL::varchar, NULL::varchar, 'active', 'verified', 51),
    (1, 'manager-1', 'user-manager', 'Kepala LPPM', NULL::varchar, NULL::varchar, 'MGR-LPPM-001', '3671010101880006', 'MGR001', 'Tangerang', '1988-01-01', 'male', 'Indonesia', 'manager@umn.ac.id', NULL::varchar, NULL::varchar, 'Tangerang', 'Universitas Multimedia Nusantara', 'LPPM', 'Manajemen Riset', 'LPPM', 'Manajer', 'manager', 'S3', 'lektor_kepala', 'fulltime', NULL::varchar, NULL::varchar, NULL::varchar, NULL::varchar, NULL::varchar, NULL::varchar, NULL::varchar, NULL::varchar, NULL::varchar, NULL::varchar, 'active', 'verified', 85),
    (2, 'admin-1', 'user-admin', 'Admin Penelitian', NULL::varchar, NULL::varchar, 'ADM-RIS-001', '3671010101900005', 'ADM001', 'Tangerang', '1990-01-01', 'male', 'Indonesia', 'admin.penelitian@umn.ac.id', NULL::varchar, NULL::varchar, 'Tangerang', 'Universitas Multimedia Nusantara', 'LPPM', 'Manajemen Riset', 'LPPM', 'Administrator Penelitian', NULL::varchar, 'S1', 'fulltime', 'fulltime', NULL::varchar, NULL::varchar, NULL::varchar, NULL::varchar, NULL::varchar, NULL::varchar, NULL::varchar, NULL::varchar, NULL::varchar, NULL::varchar, 'active', 'verified', 85),
    (3, 'admin-letter-1', 'user-admin-letter', 'Admin Pengajuan Surat', NULL::varchar, NULL::varchar, 'ADM-SRT-001', NULL::varchar, 'ADMSRT001', NULL::varchar, NULL::varchar, NULL::varchar, 'Indonesia', 'admin.surat@umn.ac.id', NULL::varchar, NULL::varchar, NULL::varchar, NULL::varchar, 'LPPM', 'Manajemen Riset', 'LPPM', 'Administrator Surat', NULL::varchar, 'S1', 'fulltime', 'fulltime', NULL::varchar, NULL::varchar, NULL::varchar, NULL::varchar, NULL::varchar, NULL::varchar, NULL::varchar, NULL::varchar, NULL::varchar, NULL::varchar, 'active', 'verified', 51),
    (4, 'admin-profile-1', 'user-admin-profile', 'Admin Informasi Peneliti', NULL::varchar, NULL::varchar, 'ADM-PRF-001', NULL::varchar, 'ADMPRF001', NULL::varchar, NULL::varchar, NULL::varchar, 'Indonesia', 'admin.profil@umn.ac.id', NULL::varchar, NULL::varchar, NULL::varchar, NULL::varchar, 'LPPM', 'Manajemen Riset', 'LPPM', 'Administrator Profil', NULL::varchar, 'S1', 'fulltime', 'fulltime', NULL::varchar, NULL::varchar, NULL::varchar, NULL::varchar, NULL::varchar, NULL::varchar, NULL::varchar, NULL::varchar, NULL::varchar, NULL::varchar, 'active', 'verified', 51),
    (5, 'lecturer-1', 'user-lecturer', 'Budi Santoso', 'Dr.', NULL::varchar, '0312048501', '3671010101850001', '201203001', 'Jakarta', '1985-12-04', 'male', 'Indonesia', 'lecturer@umn.ac.id', 'budi.santoso@gmail.com', '081234567890', 'Tangerang', 'Universitas Multimedia Nusantara', 'Fakultas Teknik dan Informatika', 'Sistem Informasi', 'Program Studi Sistem Informasi', 'Dosen', 'lektor', 'S3', 'fulltime', 'fulltime', '0000-0002-1825-0097', 'https://scholar.google.com/citations?user=budi', '6723456', 'Bank BCA', '1234567890', 'Budi Santoso', 'Siti Santoso', 'Istri', '081298765432', 'active', 'verified', 100),
    (6, 'lecturer-2', 'user-lecturer-2', 'Andini Prameswari', 'Dr.', NULL::varchar, '0308078602', '3671010807860002', '201108002', 'Bandung', '1986-07-08', 'female', 'Indonesia', 'reviewer@umn.ac.id', 'andini.prameswari@gmail.com', '081298765433', 'Tangerang', 'Universitas Multimedia Nusantara', 'Fakultas Teknik dan Informatika', 'Sistem Informasi', 'Program Studi Sistem Informasi', 'Dosen', 'lektor_kepala', 'S3', 'homebase', 'homebase', '0000-0003-1415-9265', 'https://scholar.google.com/citations?user=andini', '6789012', 'Bank Mandiri', '9876543210', 'Andini Prameswari', 'Rudi Prameswara', 'Suami', '081298765434', 'active', 'verified', 100)
  ) AS seed(
    position_index, id, user_id, full_name, front_title, back_title, nidn, nik, nip,
    birth_place, birth_date, gender, nationality, institution_email, alternate_email,
    phone_number, domicile_address, correspondence_address, faculty, study_program,
    unit, role_title, functional_position, education_level, employment_status,
    employment_kind, orcid, google_scholar, sinta_id, bank_name, bank_account_number,
    bank_account_name, emergency_contact_name, emergency_contact_relation,
    emergency_contact_phone, profile_status, verification_status, completeness
  )
)
INSERT INTO public.ris_records AS record (domain, entity_id, payload, updated_at)
SELECT
  'researcherProfiles',
  id,
  jsonb_build_object(
    'position', position_index,
    'value', jsonb_strip_nulls(jsonb_build_object(
      'id', id, 'profileId', id, 'userId', user_id, 'fullName', full_name,
      'frontTitle', front_title, 'backTitle', back_title, 'nidn', nidn, 'nik', nik,
      'nip', nip, 'birthPlace', birth_place, 'birthDate', birth_date,
      'gender', gender, 'nationality', nationality, 'institutionEmail', institution_email,
      'alternateEmail', alternate_email, 'phoneNumber', phone_number,
      'domicileAddress', domicile_address, 'correspondenceAddress', correspondence_address,
      'faculty', faculty, 'studyProgram', study_program, 'unit', unit,
      'position', role_title, 'functionalPosition', functional_position,
      'educationLevel', education_level, 'employmentStatus', employment_status,
      'orcid', orcid, 'googleScholar', google_scholar, 'sintaId', sinta_id,
      'bankName', bank_name, 'bankAccountNumber', bank_account_number,
      'bankAccountName', bank_account_name, 'emergencyContactName', emergency_contact_name,
      'emergencyContactRelation', emergency_contact_relation,
      'emergencyContactPhone', emergency_contact_phone, 'profileStatus', profile_status,
      'verificationStatus', verification_status, 'profileCompleteness', completeness,
      'createdAt', '2026-06-01T00:00:00.000Z', 'updatedAt', '2026-06-01T00:00:00.000Z',
      'lastUpdatedAt', '2026-06-01T00:00:00.000Z', 'lastUpdatedBy', 'user-super-admin'
    ))
  ),
  now()
FROM profile_runtime
ON CONFLICT (domain, entity_id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = now();

WITH lecturer_runtime AS (
  SELECT * FROM (VALUES
    (0, 'lecturer-1', 'user-lecturer', 'Dr. Budi Santoso', '0312048501', 'Fakultas Teknik dan Informatika', 'Sistem Informasi', 'S3', 'lektor', 'fulltime', 612, 14, 2026, '0000-0002-1825-0097', 'https://scholar.google.com/citations?user=budi', '6723456'),
    (1, 'lecturer-2', 'user-lecturer-2', 'Dr. Andini Prameswari', '0308078602', 'Fakultas Teknik dan Informatika', 'Sistem Informasi', 'S3', 'lektor_kepala', 'homebase', 780, 20, 2026, '0000-0003-1415-9265', 'https://scholar.google.com/citations?user=andini', '6789012'),
    (2, 'manager-1', 'user-manager', 'Manager LPPM', 'MGR-LPPM-001', 'LPPM', 'Manajemen Riset', 'S3', 'lektor_kepala', 'fulltime', 0, 0, 2026, NULL::varchar, NULL::varchar, NULL::varchar)
  ) AS seed(position_index, id, user_id, name, nidn, faculty, program, education_level,
    functional_position, employment_status, sinta_score, research_count,
    last_research_year, orcid, google_scholar, sinta_id)
)
INSERT INTO public.ris_records AS record (domain, entity_id, payload, updated_at)
SELECT
  'lecturers',
  id,
  jsonb_build_object(
    'position', position_index,
    'value', jsonb_strip_nulls(jsonb_build_object(
      'id', id, 'userId', user_id, 'name', name, 'nidn', nidn,
      'faculty', faculty, 'program', program, 'educationLevel', education_level,
      'functionalPosition', functional_position, 'employmentStatus', employment_status,
      'sintaScore', sinta_score, 'researchCount', research_count,
      'lastResearchYear', last_research_year, 'orcid', orcid,
      'googleScholar', google_scholar, 'sintaId', sinta_id
    ))
  ),
  now()
FROM lecturer_runtime
ON CONFLICT (domain, entity_id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = now();

WITH applicant_runtime AS (
  SELECT * FROM (VALUES
    (0, 'lecturer-1', 'user-lecturer', 'Dr. Budi Santoso', '0312048501', 'Dosen', 'lecturer', 'fulltime', 'Fakultas Teknik dan Informatika', 'Sistem Informasi', 'lecturer@umn.ac.id'),
    (1, 'lecturer-2', 'user-lecturer-2', 'Dr. Andini Prameswari', '0308078602', 'Dosen', 'lecturer', 'homebase', 'Fakultas Teknik dan Informatika', 'Sistem Informasi', 'reviewer@umn.ac.id'),
    (2, 'manager-1', 'user-manager', 'Kepala LPPM', 'MGR-LPPM-001', 'Manajer', 'lecturer', 'fulltime', 'LPPM', 'Manajemen Riset', 'manager@umn.ac.id')
  ) AS seed(position_index, id, user_id, name, identifier, applicant_role, applicant_kind,
    status, faculty, program, email)
)
INSERT INTO public.ris_records AS record (domain, entity_id, payload, updated_at)
SELECT
  'applicantProfiles',
  id,
  jsonb_build_object(
    'position', position_index,
    'value', jsonb_build_object(
      'id', id, 'userId', user_id, 'name', name, 'identifier', identifier,
      'applicantRole', applicant_role, 'applicantKind', applicant_kind, 'status', status,
      'faculty', faculty, 'program', program, 'email', email
    )
  ),
  now()
FROM applicant_runtime
ON CONFLICT (domain, entity_id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = now();

INSERT INTO public.ris_records AS record (domain, entity_id, payload, updated_at)
VALUES ('profileSequence', '__value', '{"position":0,"value":7}'::jsonb, now())
ON CONFLICT (domain, entity_id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = now();

-- Make existing browser sessions refresh their in-memory snapshot after the seed.
INSERT INTO public.ris_revision AS revision (id, version, updated_at)
VALUES (1, 1, now())
ON CONFLICT (id) DO UPDATE SET version = revision.version + 1, updated_at = now();

COMMIT;

-- Verification: each result should return 7, 7, 3, 3 respectively.
SELECT
  (SELECT count(*) FROM public.users WHERE lower(email) IN (
    'superadmin@umn.ac.id', 'manager@umn.ac.id', 'admin.penelitian@umn.ac.id',
    'admin.surat@umn.ac.id', 'admin.profil@umn.ac.id', 'lecturer@umn.ac.id',
    'reviewer@umn.ac.id'
  )) AS accounts,
  (SELECT count(*) FROM public.researcher_profiles WHERE lower(institution_email) IN (
    'superadmin@umn.ac.id', 'manager@umn.ac.id', 'admin.penelitian@umn.ac.id',
    'admin.surat@umn.ac.id', 'admin.profil@umn.ac.id', 'lecturer@umn.ac.id',
    'reviewer@umn.ac.id'
  )) AS relational_profiles,
  (SELECT count(*) FROM public.ris_records WHERE domain = 'researcherProfiles' AND entity_id IN (
    'super-admin-1', 'manager-1', 'admin-1', 'admin-letter-1', 'admin-profile-1',
    'lecturer-1', 'lecturer-2'
  )) AS runtime_profiles,
  (SELECT count(*) FROM public.ris_records WHERE domain = 'applicantProfiles' AND entity_id IN (
    'manager-1', 'lecturer-1', 'lecturer-2'
  )) AS applicant_profiles;
