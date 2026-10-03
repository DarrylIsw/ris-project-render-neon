-- Additive compatibility change; existing letter content and workflow history are retained.
ALTER TABLE public.letter_request_templates
  ALTER COLUMN template_format SET DEFAULT 'docx';

UPDATE public.letter_request_templates
SET template_format = 'docx'
WHERE template_format = 'txt';
