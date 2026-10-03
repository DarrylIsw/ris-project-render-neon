-- Safe for existing installations that missed the earlier external-report
-- member migration. It preserves all submitted reports and attachments.
CREATE TABLE IF NOT EXISTS external_research_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_research_id uuid NOT NULL REFERENCES external_research(id) ON DELETE CASCADE,
  role member_role_type NOT NULL DEFAULT 'anggota',
  member_type member_type NOT NULL,
  profile_id uuid REFERENCES researcher_profiles(id) ON DELETE SET NULL,
  name varchar(180) NOT NULL,
  nidn varchar(80),
  nim varchar(80),
  study_program varchar(180),
  faculty varchar(180),
  orcid varchar(40),
  position smallint NOT NULL CHECK (position > 0),
  UNIQUE (external_research_id, position)
);

ALTER TABLE external_research_members
  ADD COLUMN IF NOT EXISTS role member_role_type NOT NULL DEFAULT 'anggota';

UPDATE external_research_members
SET role = CASE WHEN position = 1 THEN 'ketua'::member_role_type ELSE 'anggota'::member_role_type END
WHERE role = 'anggota'::member_role_type;

CREATE INDEX IF NOT EXISTS external_research_members_profile_idx ON external_research_members (profile_id);
ALTER TABLE external_research_files ADD COLUMN IF NOT EXISTS display_name varchar(180);
