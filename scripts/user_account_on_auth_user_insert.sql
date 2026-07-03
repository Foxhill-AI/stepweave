-- Provision public.user_account when a new auth.users row appears (OAuth, etc.).
-- Skips when auth_user_id already exists (e.g. email signup inserted client-side first).
--
-- Run in Supabase SQL Editor after reviewing your user_account columns/constraints.
-- If you already have equivalent logic (trigger or Edge Function), do not duplicate.

CREATE OR REPLACE FUNCTION public.handle_auth_user_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  base_username text;
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.user_account WHERE auth_user_id = NEW.id
  ) THEN
    RETURN NEW;
  END IF;

  base_username :=
    COALESCE(
      NULLIF(trim(split_part(COALESCE(NEW.email, ''), '@', 1)), ''),
      'user_' || replace(substring(NEW.id::text, 1, 8), '-', '')
    );

  INSERT INTO public.user_account (auth_user_id, username)
  VALUES (NEW.id, base_username);

  RETURN NEW;
EXCEPTION
  WHEN unique_violation THEN
    INSERT INTO public.user_account (auth_user_id, username)
    VALUES (
      NEW.id,
      'user_' || replace(NEW.id::text, '-', '')
    );
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_user_account ON auth.users;

CREATE TRIGGER on_auth_user_created_user_account
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_auth_user_created();

-- If your Postgres rejects EXECUTE FUNCTION, use:
-- EXECUTE PROCEDURE public.handle_auth_user_created();
