// Rewrites profiles.state / profiles.district to the canonical names in
// lib/india-regions.ts (e.g. "Orissa" -> "Odisha", "Trivandrum" ->
// "Thiruvananthapuram"). Only values that match are changed; anything that
// doesn't match is left exactly as it is (people pick it in Settings).
//
//   npx tsx --env-file=.env scripts/normalize-regions.ts            (dry run: shows old -> new values, no names)
//   npx tsx --env-file=.env scripts/normalize-regions.ts --apply
//
// Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (never printed).

import { createClient } from '@supabase/supabase-js';
import { resolveRegion } from '../lib/india-regions';

const apply = process.argv.includes('--apply');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
});

async function main() {
    const { data, error } = await supabase.from('profiles').select('id, state, district');
    if (error) throw new Error(error.message);

    const changes: { id: string; state: string | null; district: string | null }[] = [];
    const summary = new Map<string, number>();
    let unmatched = 0;
    for (const p of data ?? []) {
        if (!p.state && !p.district) continue;
        const r = resolveRegion(p.state, p.district);
        // Keep what can't be matched rather than blanking it.
        const state = r.state || p.state;
        const district = r.district || p.district;
        if (!r.district && p.district) unmatched++;
        if (state !== p.state || district !== p.district) {
            changes.push({ id: p.id, state, district });
            const key = `${p.state ?? '∅'} / ${p.district ?? '∅'}  ->  ${state ?? '∅'} / ${district ?? '∅'}`;
            summary.set(key, (summary.get(key) ?? 0) + 1);
        }
    }

    console.log(`profiles with a state or district: ${(data ?? []).filter(p => p.state || p.district).length}`);
    console.log(`to change: ${changes.length}, district not matched (left as is): ${unmatched}`);
    for (const [k, n] of [...summary].sort()) console.log(`  ${n} × ${k}`);
    if (!apply) { console.log('dry run: nothing changed (use --apply)'); return; }

    let ok = 0;
    for (const c of changes) {
        const { error: e } = await supabase.from('profiles').update({ state: c.state, district: c.district }).eq('id', c.id);
        if (e) console.error(`update failed: ${e.message}`); else ok++;
    }
    console.log(`updated: ${ok} of ${changes.length}`);
}

main().catch(e => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
