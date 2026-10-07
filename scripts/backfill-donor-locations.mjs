#!/usr/bin/env node
// Backfill profiles.location for donors from their PIN code (present_zip).
//
// Run AFTER supabase/migrations/20261008000500_location_placeholders.sql, which
// clears the old {0,0} placeholders. Only donors with location IS NULL are touched.
//
//   node --env-file=.env scripts/backfill-donor-locations.mjs --dry-run   (default)
//   node --env-file=.env scripts/backfill-donor-locations.mjs --apply
//   ... --include-city   also geocode donors with no valid PIN but a city
//
// Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (never printed).
//
// Nominatim policy: one request at a time, >= 1.1 s apart, identifying
// User-Agent; each distinct PIN / city is looked up once. Output is counts only
// (no names, PINs, cities or coordinates).

import { createClient } from '@supabase/supabase-js';

const args = new Set(process.argv.slice(2));
for (const a of args) {
    if (!['--dry-run', '--apply', '--include-city', '-h', '--help'].includes(a)) {
        console.error(`Unknown argument: ${a}`);
        process.exit(2);
    }
}
if (args.has('-h') || args.has('--help')) {
    console.log('Usage: node --env-file=.env scripts/backfill-donor-locations.mjs [--dry-run | --apply] [--include-city]');
    process.exit(0);
}
if (args.has('--apply') && args.has('--dry-run')) {
    console.error('Pass either --dry-run or --apply, not both.');
    process.exit(2);
}
const APPLY = args.has('--apply');
const INCLUDE_CITY = args.has('--include-city');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in the environment.');
    process.exit(2);
}

const USER_AGENT = 'Vital/1.0 (https://vitalapp.in; sachin@vitalapp.in)';
const NOMINATIM = 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=in';
const GAP_MS = 1100;
const PIN_RE = /^[1-9][0-9]{5}$/;

const sleep = ms => new Promise(r => setTimeout(r, ms));
const round3 = n => Math.round(n * 1000) / 1000;
const insideIndia = (lat, lng) =>
    Number.isFinite(lat) && Number.isFinite(lng) && lat >= 6 && lat <= 37.5 && lng >= 68 && lng <= 97.5;

let lastRequest = 0;
let requests = 0;
let upstreamErrors = 0;

async function nominatim(params) {
    const wait = lastRequest + GAP_MS - Date.now();
    if (wait > 0) await sleep(wait);
    lastRequest = Date.now();
    requests++;
    try {
        const res = await fetch(`${NOMINATIM}&${params}`, {
            headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'en' },
            signal: AbortSignal.timeout(10000),
        });
        if (!res.ok) { upstreamErrors++; return null; }
        const data = await res.json();
        if (!Array.isArray(data) || data.length === 0) return null;
        const lat = Number(data[0].lat);
        const lng = Number(data[0].lon);
        return insideIndia(lat, lng) ? { latitude: round3(lat), longitude: round3(lng) } : null;
    } catch {
        upstreamErrors++;
        return null;
    } finally {
        lastRequest = Date.now();
    }
}

/** Same order as app/api/profile/location: postal code, PIN as text, then city. */
async function geocode(target) {
    if (target.kind === 'pin') {
        return (await nominatim(`postalcode=${target.value}`))
            ?? (await nominatim(`q=${encodeURIComponent(`${target.value} India`)}`));
    }
    return nominatim(`city=${encodeURIComponent(target.value)}`);
}

const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

// Load donors without a location (paged).
const donors = [];
for (let from = 0; ; from += 1000) {
    const { data, error } = await db
        .from('profiles')
        .select('id, present_zip, city')
        .eq('is_donor', true)
        .is('location', null)
        .order('id')
        .range(from, from + 999);
    if (error) {
        console.error(`Could not read profiles (code ${error.code ?? 'unknown'}).`);
        process.exit(1);
    }
    donors.push(...data);
    if (data.length < 1000) break;
}

// Group donors by lookup target so each PIN / city is geocoded once.
const groups = new Map(); // "pin:682011" -> { target, ids[] }
let skipped = 0;
for (const d of donors) {
    const zip = typeof d.present_zip === 'string' ? d.present_zip.replace(/\s/g, '') : '';
    const city = typeof d.city === 'string' ? d.city.trim().slice(0, 100) : '';
    let target = null;
    if (PIN_RE.test(zip)) target = { kind: 'pin', value: zip };
    else if (INCLUDE_CITY && city) target = { kind: 'city', value: city };
    if (!target) { skipped++; continue; }
    const k = `${target.kind}:${target.kind === 'city' ? target.value.toLowerCase() : target.value}`;
    if (!groups.has(k)) groups.set(k, { target, ids: [] });
    groups.get(k).ids.push(d.id);
}

const pinGroups = [...groups.values()].filter(g => g.target.kind === 'pin');
const cityGroups = [...groups.values()].filter(g => g.target.kind === 'city');
console.log(`Mode: ${APPLY ? 'APPLY (writes profiles.location)' : 'dry run (no writes)'}`);
console.log(`Donors without a location: ${donors.length}`);
console.log(`  with a valid PIN code: ${pinGroups.reduce((n, g) => n + g.ids.length, 0)} (${pinGroups.length} distinct PINs)`);
if (INCLUDE_CITY) console.log(`  city only: ${cityGroups.reduce((n, g) => n + g.ids.length, 0)} (${cityGroups.length} distinct cities)`);
console.log(`  skipped (no valid PIN${INCLUDE_CITY ? ' or city' : ''}): ${skipped}`);

let located = 0, notFound = 0, written = 0, writeFailed = 0;
const geocodedAt = new Date().toISOString();
for (const { target, ids } of groups.values()) {
    const coords = await geocode(target);
    if (!coords) { notFound += ids.length; continue; }
    located += ids.length;
    if (!APPLY) continue;
    const location = { ...coords, source: target.kind, geocoded_at: geocodedAt };
    // "location IS NULL" again: never overwrite a value the app wrote meanwhile.
    const { data, error } = await db.from('profiles').update({ location }).in('id', ids).is('location', null).select('id');
    if (error) writeFailed += ids.length;
    else written += data.length;
}

console.log(`Nominatim requests: ${requests} (errors: ${upstreamErrors})`);
console.log(`Donors geocoded: ${located}, not found: ${notFound}`);
if (APPLY) console.log(`Rows written: ${written}, write failures: ${writeFailed}`);
else console.log('Dry run: nothing written. Re-run with --apply to write.');
process.exit(writeFailed > 0 ? 1 : 0);
