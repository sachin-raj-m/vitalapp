#!/usr/bin/env bash
# RLS / security test suite for the Supabase migrations.
#
# Spins up a throwaway Postgres cluster (initdb into a temp dir), applies
# supabase/tests/stub.sql + every migration in supabase/migrations in order,
# loads supabase/tests/seed.sql, runs supabase/tests/*.test.sql, prints a
# PASS/FAIL summary and tears everything down. Never touches a remote database.
#
# Requirements: initdb, pg_ctl, psql on PATH (e.g. `brew install postgresql@16`).
#
# Usage:
#   npm run test:rls
#   bash scripts/test-rls.sh [-v] [--keep]
#
# Env:
#   RLS_TEST_PORT   TCP port for the throwaway server (default 54330)
#   -v / VERBOSE=1  print every assertion, not just failures
#   --keep          leave the server running afterwards (prints how to connect)

set -uo pipefail
shopt -s nullglob

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${RLS_TEST_PORT:-54330}"
VERBOSE="${VERBOSE:-0}"
KEEP=0
for arg in "$@"; do
  case "$arg" in
    -v|--verbose) VERBOSE=1 ;;
    --keep) KEEP=1 ;;
    -h|--help) sed -n '2,19p' "$0"; exit 0 ;;
    *) echo "unknown argument: $arg" >&2; exit 2 ;;
  esac
done

# Migrations known to fail on a fresh replay (drift from the live project).
# They are reported as warnings, not failures. Remove entries once fixed.
KNOWN_BROKEN=()

red() { printf '\033[31m%s\033[0m\n' "$*"; }
green() { printf '\033[32m%s\033[0m\n' "$*"; }
yellow() { printf '\033[33m%s\033[0m\n' "$*"; }

for bin in initdb pg_ctl psql; do
  command -v "$bin" >/dev/null 2>&1 || { red "missing '$bin' on PATH (brew install postgresql@16)"; exit 2; }
done

if (exec 3<>"/dev/tcp/127.0.0.1/$PORT") 2>/dev/null; then
  red "port $PORT is already in use; set RLS_TEST_PORT to a free port"
  exit 2
fi

TMP="$(mktemp -d "${TMPDIR:-/tmp}/vital-rls.XXXXXX")"
PGDATA="$TMP/data"
LOG="$TMP/postgres.log"
DB=vital_rls_test

cleanup() {
  if [ "$KEEP" = 1 ]; then
    yellow "server left running: psql -h 127.0.0.1 -p $PORT -U postgres -d $DB"
    yellow "stop it with: pg_ctl -D $PGDATA stop && rm -rf $TMP"
    return
  fi
  pg_ctl -D "$PGDATA" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$TMP"
}
trap cleanup EXIT

echo "==> initdb (throwaway cluster in $TMP)"
initdb -D "$PGDATA" -U postgres -A trust -E UTF8 --no-locale >"$TMP/initdb.log" 2>&1 \
  || { cat "$TMP/initdb.log"; red "initdb failed"; exit 2; }

# TCP only: the temp dir path can exceed the Unix socket path limit on macOS.
pg_ctl -D "$PGDATA" -l "$LOG" -w -t 30 \
  -o "-p $PORT -c listen_addresses=127.0.0.1 -c unix_socket_directories='' -c fsync=off -c full_page_writes=off" \
  start >/dev/null || { cat "$LOG"; red "postgres failed to start"; exit 2; }

export PGHOST=127.0.0.1 PGPORT="$PORT" PGUSER=postgres PGOPTIONS='-c client_min_messages=warning'
PSQL=(psql -X -q -v ON_ERROR_STOP=1)

"${PSQL[@]}" -d postgres -c "CREATE DATABASE $DB" || exit 2

echo "==> stub (auth / storage / API roles)"
"${PSQL[@]}" -d "$DB" -f "$ROOT/supabase/tests/stub.sql" || { red "stub failed"; exit 2; }

echo "==> migrations"
migration_errors=0
for f in "$ROOT"/supabase/migrations/*.sql; do
  name="$(basename "$f")"
  # --single-transaction: a failing migration leaves nothing half-applied.
  if out="$("${PSQL[@]}" -d "$DB" --single-transaction -f "$f" 2>&1)"; then
    [ "$VERBOSE" = 1 ] && echo "   ok  $name"
  else
    known=0
    for k in "${KNOWN_BROKEN[@]}"; do [ "$k" = "$name" ] && known=1; done
    if [ "$known" = 1 ]; then
      yellow "   WARN $name failed (known broken on fresh replay, continuing):"
      echo "$out" | grep -m1 ERROR | sed 's/^/        /'
    else
      red "   FAIL $name"
      echo "$out" | sed 's/^/        /'
      migration_errors=$((migration_errors + 1))
    fi
  fi
done
if [ "$migration_errors" -gt 0 ]; then
  red "$migration_errors migration(s) failed; not running tests"
  exit 1
fi

echo "==> seed"
"${PSQL[@]}" -d "$DB" -f "$ROOT/supabase/tests/seed.sql" || { red "seed failed"; exit 1; }

echo "==> tests"
pass=0; fail=0; files_failed=0
for t in "$ROOT"/supabase/tests/*.test.sql; do
  out="$("${PSQL[@]}" -d "$DB" -f "$t" 2>&1)"
  status=$?
  p=$(printf '%s\n' "$out" | grep -c 'PASS:' || true)
  f=$(printf '%s\n' "$out" | grep -c 'FAIL:' || true)
  pass=$((pass + p)); fail=$((fail + f))
  if [ "$VERBOSE" = 1 ]; then
    printf '%s\n' "$out" | grep -E 'PASS:|FAIL:' | sed -E 's/^.*(PASS:|FAIL:)/\1/'
  else
    printf '%s\n' "$out" | grep 'FAIL:' | sed -E 's/^.*FAIL:/FAIL:/'
  fi
  if [ "$status" -ne 0 ]; then
    files_failed=$((files_failed + 1))
    red "$(basename "$t") aborted:"
    printf '%s\n' "$out" | grep -E 'ERROR|FATAL' | grep -v 'FAIL:' | sed 's/^/    /'
  fi
done

echo
if [ "$fail" -eq 0 ] && [ "$files_failed" -eq 0 ] && [ "$pass" -gt 0 ]; then
  green "RLS tests: $pass passed, 0 failed"
  exit 0
fi
red "RLS tests: $pass passed, $fail failed$([ "$files_failed" -gt 0 ] && echo ", $files_failed file(s) aborted")"
exit 1
