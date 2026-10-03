-- Apply this file directly to an existing database.sql installation, or run
-- `npx prisma migrate deploy` when the Prisma baseline is already registered.
CREATE TABLE IF NOT EXISTS external_research_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_research_id uuid NOT NULL REFERENCES external_research(id) ON DELETE CASCADE,
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

CREATE INDEX IF NOT EXISTS external_research_members_profile_idx ON external_research_members (profile_id);
ALTER TABLE external_research_files ADD COLUMN IF NOT EXISTS display_name varchar(180);
