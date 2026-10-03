-- Near-real-time transactional outbox support. This migration is additive and
-- preserves every existing queued, sent, failed, and cancelled email row.
ALTER TABLE public.email_outbox
  ADD COLUMN IF NOT EXISTS worker_id varchar(120);

CREATE INDEX IF NOT EXISTS email_outbox_processing_lock_idx
  ON public.email_outbox (status, locked_at)
  WHERE status = 'processing';


