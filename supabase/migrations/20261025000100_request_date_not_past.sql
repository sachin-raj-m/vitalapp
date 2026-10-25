/*
  # New requests can't be needed by a date that has already passed

  A request dated in the past is expired the moment it's posted: it's hidden
  from donors and its page shows "not found", yet the alert went out. The form
  now refuses past dates; this enforces it for every client. "Today" is the date
  in India.

  Only new requests and changes to date_needed are checked, so existing expired
  requests can still be cancelled or fulfilled.
*/
CREATE OR REPLACE FUNCTION public.check_request_date()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.date_needed IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.date_needed IS DISTINCT FROM OLD.date_needed)
     AND NEW.date_needed < (now() AT TIME ZONE 'Asia/Kolkata')::date THEN
    RAISE EXCEPTION 'Choose today or a later date for "Needed by"' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.check_request_date() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS blood_requests_check_date ON public.blood_requests;
CREATE TRIGGER blood_requests_check_date
  BEFORE INSERT OR UPDATE OF date_needed ON public.blood_requests
  FOR EACH ROW EXECUTE FUNCTION public.check_request_date();
