// Checks how typed states/districts resolve to the listed names in
// lib/india-regions.ts, and that every listed name still matches itself.
// No database or network access.
//
//   npx tsx scripts/check-region-matching.ts

import { INDIA_REGIONS, matchDistrict, matchState, resolveRegion } from '../lib/india-regions';

const cases: [state: string, district: string, expected: [string, string]][] = [
    // Union territories
    ['New Delhi', '', ['Delhi', '']],
    ['NCT', 'South Delhi', ['Delhi', 'South']],
    ['Delhi NCR', 'New Delhi', ['Delhi', 'New Delhi']],
    ['Pondy', 'Pondicherry', ['Puducherry', 'Puducherry']],
    ['Pondicherry', 'Karikal', ['Puducherry', 'Karaikal']],
    ['Puducherry', 'Mahe', ['Puducherry', 'Mahe']],
    ['', 'Yanam', ['Puducherry', 'Yanam']],
    ['J&K', 'Srinagar', ['Jammu and Kashmir', 'Srinagar']],
    ['Jammu & Kashmir', 'Badgam', ['Jammu and Kashmir', 'Budgam']],
    ['Andaman', 'Port Blair', ['Andaman and Nicobar Islands', 'South Andamans']],
    ['A&N Islands', 'Car Nicobar', ['Andaman and Nicobar Islands', 'Nicobars']],
    ['', 'Port Blair', ['Andaman and Nicobar Islands', 'South Andamans']],
    ['Daman', 'Daman', ['Dadra and Nagar Haveli and Daman and Diu', 'Daman']],
    ['Silvassa', 'Silvassa', ['Dadra and Nagar Haveli and Daman and Diu', 'Dadra and Nagar Haveli']],
    ['Leh', 'Leh Ladakh', ['Ladakh', 'Leh']],
    ['Ladakh', 'Kargil', ['Ladakh', 'Kargil']],
    ['', 'Kargil', ['Ladakh', 'Kargil']],
    ['Lakshadweep', 'Kavaratti', ['Lakshadweep', 'Lakshadweep']],
    ['Chandigarh', 'Chandigarh', ['Chandigarh', 'Chandigarh']],
    // Existing matching keeps working
    ['Kerala', 'Trivandrum', ['Kerala', 'Thiruvananthapuram']],
    ['Orissa', 'Kataka', ['Odisha', 'Cuttack']],
    ['', 'Aurangabad', ['', '']],
    ['Maharashtra', 'Aurangabad', ['Maharashtra', 'Chhatrapati Sambhajinagar']],
    ['', 'Ernakulam', ['Kerala', 'Ernakulam']],
    ['Delhi', 'Gurgaon', ['Delhi', '']],
    ['Nowhere', 'Somewhere', ['', '']],
];

let failed = 0;
for (const [state, district, [es, ed]] of cases) {
    const r = resolveRegion(state, district);
    const ok = r.state === es && r.district === ed;
    if (!ok) failed++;
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${JSON.stringify([state, district])} -> ${JSON.stringify([r.state, r.district])}${ok ? '' : ` (expected ${JSON.stringify([es, ed])})`}`);
}

// Every listed name must still match itself (an alias must not take over one).
for (const r of INDIA_REGIONS) {
    if (matchState(r.name) !== r.name) { failed++; console.log(`FAIL state ${r.name} -> ${matchState(r.name)}`); }
    for (const d of r.districts) {
        if (matchDistrict(r.name, d) !== d) { failed++; console.log(`FAIL district ${r.name} / ${d} -> ${matchDistrict(r.name, d)}`); }
    }
}

const uts = INDIA_REGIONS.filter(r => r.type === 'ut');
console.log(`\n${INDIA_REGIONS.length - uts.length} states, ${uts.length} UTs:`);
for (const u of uts) console.log(`  ${u.name}: ${u.districts.length} (${u.districts.join(', ')})`);

console.log(failed ? `\n${failed} failed` : '\nAll passed');
process.exit(failed ? 1 : 0);
