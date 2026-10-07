-- Tiny assertion library for the RLS tests. Lives in its own "tests" schema so
-- it never mixes with the app's public schema (or its catalog checks).
--
-- Every assertion prints "PASS: <label>" or "FAIL: <label> ..." as a WARNING;
-- scripts/test-rls.sh counts them and exits non-zero on any FAIL. Assertions
-- run the statement under test as the *current* role, so call tests.login()
-- first. Statements passed as text to denied()/throws()/affected() are always
-- rolled back; write them as plain SQL in the test file when the change should
-- persist.

CREATE SCHEMA IF NOT EXISTS tests;
GRANT USAGE ON SCHEMA tests TO anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS tests.users (name text PRIMARY KEY, id uuid NOT NULL);
GRANT SELECT ON tests.users TO anon, authenticated, service_role;

-- Act as a fixture user the way PostgREST does: SET ROLE + JWT claim GUCs.
-- 'anon' = signed-out visitor, 'service' = service role key, 'postgres' = back to superuser.
CREATE OR REPLACE FUNCTION tests.login(p_name text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE v_id uuid;
BEGIN
  PERFORM set_config('role', 'none', false);
  IF p_name = 'postgres' THEN
    PERFORM set_config('request.jwt.claim.sub', '', false);
    PERFORM set_config('request.jwt.claim.role', '', false);
  ELSIF p_name = 'anon' THEN
    PERFORM set_config('request.jwt.claim.sub', '', false);
    PERFORM set_config('request.jwt.claim.role', 'anon', false);
    PERFORM set_config('role', 'anon', false);
  ELSIF p_name = 'service' THEN
    PERFORM set_config('request.jwt.claim.sub', '', false);
    PERFORM set_config('request.jwt.claim.role', 'service_role', false);
    PERFORM set_config('role', 'service_role', false);
  ELSE
    SELECT id INTO v_id FROM tests.users WHERE name = p_name;
    IF v_id IS NULL THEN RAISE EXCEPTION 'tests.login: unknown fixture user %', p_name; END IF;
    PERFORM set_config('request.jwt.claim.sub', v_id::text, false);
    PERFORM set_config('request.jwt.claim.role', 'authenticated', false);
    PERFORM set_config('role', 'authenticated', false);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION tests.uid(p_name text) RETURNS uuid LANGUAGE sql STABLE AS
$$ SELECT id FROM tests.users WHERE name = p_name $$;

CREATE OR REPLACE FUNCTION tests.pass(p_label text) RETURNS void LANGUAGE plpgsql AS
$$ BEGIN RAISE WARNING 'PASS: %', p_label; END $$;
CREATE OR REPLACE FUNCTION tests.fail(p_label text, p_detail text) RETURNS void LANGUAGE plpgsql AS
$$ BEGIN RAISE WARNING 'FAIL: % -- %', p_label, p_detail; END $$;

CREATE OR REPLACE FUNCTION tests.ok(p_cond boolean, p_label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_cond IS TRUE THEN PERFORM tests.pass(p_label);
  ELSE PERFORM tests.fail(p_label, 'condition was ' || coalesce(p_cond::text, 'NULL'));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION tests.is(p_got anyelement, p_want anyelement, p_label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_got IS NOT DISTINCT FROM p_want THEN PERFORM tests.pass(p_label);
  ELSE PERFORM tests.fail(p_label, format('got %s, expected %s', coalesce(p_got::text, 'NULL'), coalesce(p_want::text, 'NULL')));
  END IF;
END $$;

-- Runs p_sql in a subtransaction, returns the row count, and rolls it back.
-- Errors propagate (use tests.throws / tests.denied when an error is expected).
CREATE OR REPLACE FUNCTION tests.affected(p_sql text) RETURNS integer LANGUAGE plpgsql AS $$
DECLARE n integer;
BEGIN
  BEGIN
    EXECUTE p_sql;
    GET DIAGNOSTICS n = ROW_COUNT;
    RAISE EXCEPTION 'tests.rollback' USING ERRCODE = 'TT001';
  EXCEPTION WHEN SQLSTATE 'TT001' THEN
    RETURN n;
  END;
END $$;

-- Number of rows a query returns (read-only).
CREATE OR REPLACE FUNCTION tests.rows(p_sql text) RETURNS bigint LANGUAGE plpgsql AS $$
DECLARE n bigint;
BEGIN
  EXECUTE format('SELECT count(*) FROM (%s) q', p_sql) INTO n;
  RETURN n;
END $$;

-- First column of the first row of a query, as text (NULL if no rows).
CREATE OR REPLACE FUNCTION tests.val(p_sql text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE v text;
BEGIN
  EXECUTE p_sql INTO v;
  RETURN v;
END $$;

-- PASS if p_sql raises an error whose "SQLSTATE message" matches p_pattern (regex, case-insensitive).
-- Always rolled back, so a statement that unexpectedly succeeds changes nothing.
CREATE OR REPLACE FUNCTION tests.throws(p_sql text, p_pattern text, p_label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE p_sql;
    RAISE EXCEPTION 'tests.rollback' USING ERRCODE = 'TT001';
  EXCEPTION WHEN SQLSTATE 'TT001' THEN
    NULL;  -- succeeded; fall through to FAIL below
  WHEN OTHERS THEN
    IF (SQLSTATE || ' ' || SQLERRM) ~* p_pattern THEN
      PERFORM tests.pass(p_label);
    ELSE
      PERFORM tests.fail(p_label, format('raised %s %s, expected /%s/', SQLSTATE, SQLERRM, p_pattern));
    END IF;
    RETURN;
  END;
  PERFORM tests.fail(p_label, format('no error raised, expected /%s/', p_pattern));
END $$;

-- PASS if p_sql is blocked: permission denied / RLS violation (SQLSTATE 42501),
-- a non-updatable view column (0A000), or it touches/returns zero rows.
-- Always rolled back.
CREATE OR REPLACE FUNCTION tests.denied(p_sql text, p_label text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE n integer;
BEGIN
  BEGIN
    n := tests.affected(p_sql);
  EXCEPTION WHEN insufficient_privilege OR feature_not_supported THEN
    PERFORM tests.pass(p_label);
    RETURN;
  WHEN OTHERS THEN
    PERFORM tests.fail(p_label, format('unexpected error %s %s', SQLSTATE, SQLERRM));
    RETURN;
  END;
  IF n = 0 THEN PERFORM tests.pass(p_label);
  ELSE PERFORM tests.fail(p_label, format('%s row(s) affected/returned, expected none', n));
  END IF;
END $$;

-- PASS if p_sql succeeds and touches/returns exactly p_n rows. Always rolled back.
CREATE OR REPLACE FUNCTION tests.allowed(p_sql text, p_n integer, p_label text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE n integer;
BEGIN
  BEGIN
    n := tests.affected(p_sql);
  EXCEPTION WHEN OTHERS THEN
    PERFORM tests.fail(p_label, format('raised %s %s', SQLSTATE, SQLERRM));
    RETURN;
  END;
  PERFORM tests.is(n, p_n, p_label);
END $$;

GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA tests TO anon, authenticated, service_role;
