-- Serialize Printful Mockup Generator calls across all users (one concurrent create-task per store).
-- Run in Supabase SQL Editor if migrations are not applied automatically.

CREATE TABLE IF NOT EXISTS public.printful_mockup_slot (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  locked_until timestamptz,
  holder text
);

INSERT INTO public.printful_mockup_slot (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.printful_mockup_slot ENABLE ROW LEVEL SECURITY;

-- No policies: only service_role (bypasses RLS) used from API routes.

CREATE OR REPLACE FUNCTION public.printful_mockup_acquire(p_holder text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n int;
BEGIN
  UPDATE public.printful_mockup_slot
  SET
    locked_until = now() + interval '4 minutes',
    holder = p_holder
  WHERE id = 1
    AND (locked_until IS NULL OR locked_until < now());
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n > 0;
END;
$$;

CREATE OR REPLACE FUNCTION public.printful_mockup_release(p_holder text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.printful_mockup_slot
  SET locked_until = NULL, holder = NULL
  WHERE id = 1 AND holder = p_holder;
END;
$$;

GRANT EXECUTE ON FUNCTION public.printful_mockup_acquire(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.printful_mockup_release(text) TO service_role;
