/*
  # Public impact numbers

  public_stats() feeds the landing page and How it works. It now returns more
  totals; the original keys (donors, open, fulfilled) keep their meaning so
  existing callers (landing page, /api/health) are unaffected.

  Every value is an aggregate count or sum. No ids, names, cities, phone
  numbers or anything else about a person is returned. It stays SECURITY
  DEFINER because anon cannot read profiles or donations directly.

  Definitions (keep in step with the app):

    members                 Accounts with a completed registration: full_name,
                            phone, city and district all filled in. Same rule as
                            isRegistrationComplete() in lib/auth-helpers.ts.
    donors                  Profiles registered as donors with a blood group
                            (is_donor AND blood_group IS NOT NULL). Unchanged.
    available_donors        Of those donors, the ones currently marked available
                            (is_available). Self-declared; not an eligibility check.
    cities                  Distinct non-empty donor cities, compared trimmed and
                            case-insensitively ("Kochi" = " kochi ").
    open                    Requests that are active and not past their
                            needed-by date. Same rule as isRequestOpen() in
                            lib/requests.ts and the admin page. Unchanged.
    fulfilled               Requests with status 'fulfilled' (all units confirmed,
                            or closed as fulfilled by the requester/admin). Unchanged.
    requests_with_donation  Requests with at least one completed donation.
    requests_helped         Requests fulfilled OR with at least one completed
                            donation (i.e. fulfilled + partially collected).
    donations_completed     Donations with status 'completed', i.e. confirmed
                            by the requester with the donor's PIN.
    units_donated           Sum of units_donated over completed donations.

  "Completed" means recorded on Vital with the donor's PIN. Vital does not
  check donations with the hospital or blood bank, and the UI says so.

  Cost: three scans of small tables, run at most every few minutes because the
  pages cache the result (revalidate) instead of calling this per view.
*/
CREATE OR REPLACE FUNCTION public.public_stats()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH p AS (
    SELECT
      count(*) FILTER (
        WHERE nullif(btrim(full_name), '') IS NOT NULL
          AND nullif(btrim(phone), '') IS NOT NULL
          AND nullif(btrim(city), '') IS NOT NULL
          AND nullif(btrim(district), '') IS NOT NULL
      ) AS members,
      count(*) FILTER (WHERE is_donor AND blood_group IS NOT NULL) AS donors,
      count(*) FILTER (WHERE is_donor AND blood_group IS NOT NULL AND is_available) AS available_donors,
      count(DISTINCT lower(btrim(city))) FILTER (
        WHERE is_donor AND blood_group IS NOT NULL AND nullif(btrim(city), '') IS NOT NULL
      ) AS cities
    FROM public.profiles
  ),
  d AS (
    SELECT
      count(*) AS donations_completed,
      coalesce(sum(coalesce(units_donated, 0)), 0) AS units_donated
    FROM public.donations
    WHERE status = 'completed'
  ),
  r AS (
    SELECT
      count(*) FILTER (
        WHERE br.status = 'active' AND (br.date_needed IS NULL OR br.date_needed >= current_date)
      ) AS open,
      count(*) FILTER (WHERE br.status = 'fulfilled') AS fulfilled,
      count(*) FILTER (WHERE c.request_id IS NOT NULL) AS requests_with_donation,
      count(*) FILTER (WHERE br.status = 'fulfilled' OR c.request_id IS NOT NULL) AS requests_helped
    FROM public.blood_requests br
    LEFT JOIN (
      SELECT DISTINCT request_id FROM public.donations WHERE status = 'completed'
    ) c ON c.request_id = br.id
  )
  SELECT jsonb_build_object(
    'members', p.members,
    'donors', p.donors,
    'available_donors', p.available_donors,
    'cities', p.cities,
    'open', r.open,
    'fulfilled', r.fulfilled,
    'requests_with_donation', r.requests_with_donation,
    'requests_helped', r.requests_helped,
    'donations_completed', d.donations_completed,
    'units_donated', d.units_donated
  )
  FROM p, d, r;
$$;

COMMENT ON FUNCTION public.public_stats() IS
  'Aggregate, anonymous totals for the public pages. Definitions: see migration 20261017000500_public_stats.sql.';

REVOKE ALL ON FUNCTION public.public_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_stats() TO anon, authenticated, service_role;
