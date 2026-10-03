CREATE UNIQUE INDEX IF NOT EXISTS funded_research_identity_unique
  ON funded_research (id, scheme_id, lead_user_id);

CREATE TABLE ris_records (
  domain varchar(80) NOT NULL,
  entity_id varchar(180) NOT NULL,
  payload jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (domain, entity_id)
);

CREATE TABLE ris_revision (
  id integer PRIMARY KEY,
  version integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
