ALTER TABLE public.user_sessions ADD COLUMN IF NOT EXISTS mfa_verified_at timestamptz;

CREATE TABLE IF NOT EXISTS public.user_mfa (
  user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  secret_ciphertext text NOT NULL,
  confirmed_at timestamptz,
  last_used_step bigint NOT NULL DEFAULT -1,
  created_at timestamptz NOT NULL DEFAULT now()
);
