// Shared bits for the dynamic OpenGraph images and posters (edge runtime: no Node-only imports).

import { createClient } from '@supabase/supabase-js';
import { SITE_URL } from '@/lib/site';
import { compatibleDonorGroups, formatNeededBy, unitsLabel, URGENCY_LABEL } from '@/lib/share';
import { isRequestOpen } from '@/lib/requests';

export const OG_SIZE = { width: 1200, height: 630 };
export const POSTER_SIZE = { width: 1080, height: 1350 };

export const OG_COLORS = {
    paper: '#FAF8F5',
    white: '#FFFFFF',
    ink: '#1B1815',
    muted: '#7E776E',
    line: '#E7E2DA',
    red: '#E11D2E',
    redSoft: '#FDE8EA',
    redDeep: '#B5161B',
    inkSoft: '#F1EEEA',
};

/** "vitalapp.in" (or the host of NEXT_PUBLIC_SITE_URL). */
export const SITE_HOST = SITE_URL.replace(/^https?:\/\//, '');

type FontWeight = 400 | 500 | 600 | 700 | 800;
type FontStyle = 'normal' | 'italic';

export type OgFontSet = {
    /** Font data for ImageResponse, or undefined to use the built-in default. */
    fonts?: { name: string; data: ArrayBuffer; weight: FontWeight; style: FontStyle }[];
    /** Family names to use in styles; fall back to generic names when a fetch failed. */
    serif: string;
    sans: string;
};

const SERIF = 'Cormorant Garamond';
const SANS = 'Manrope';

/** Fetches one TTF from Google Fonts. Returns null if unavailable so images still render. */
async function loadGoogleFont(family: string, weight: FontWeight, style: FontStyle = 'normal'): Promise<ArrayBuffer | null> {
    try {
        const axis = style === 'italic' ? `ital,wght@1,${weight}` : `wght@${weight}`;
        const css = await fetch(`https://fonts.googleapis.com/css2?family=${family.replace(/ /g, '+')}:${axis}`, {
            // An old UA makes Google return a TTF, which Satori can read.
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 6.1) AppleWebKit/534.30 (KHTML, like Gecko)' },
        }).then(r => r.text());
        const url = css.match(/src: url\((.+?)\) format/)?.[1];
        if (!url) return null;
        const res = await fetch(url);
        return res.ok ? await res.arrayBuffer() : null;
    } catch {
        return null;
    }
}

/**
 * Loads Cormorant Garamond (600, upright + italic) for the wordmark and display text, and
 * Manrope 500 + 800 for body and bold data. Use fontWeight 800 with the sans family for bold.
 */
export async function loadOgFonts(): Promise<OgFontSet> {
    const [serif, serifItalic, sans, sansBold] = await Promise.all([
        loadGoogleFont(SERIF, 600),
        loadGoogleFont(SERIF, 600, 'italic'),
        loadGoogleFont(SANS, 500),
        loadGoogleFont(SANS, 800),
    ]);

    const fonts: NonNullable<OgFontSet['fonts']> = [];
    // Manrope first so it is Satori's fallback for any text without an explicit family.
    if (sans) fonts.push({ name: SANS, data: sans, weight: 500, style: 'normal' });
    if (sansBold) fonts.push({ name: SANS, data: sansBold, weight: 800, style: 'normal' });
    if (serif) fonts.push({ name: SERIF, data: serif, weight: 600, style: 'normal' });
    if (serifItalic) fonts.push({ name: SERIF, data: serifItalic, weight: 600, style: 'italic' });

    return {
        fonts: fonts.length ? fonts : undefined,
        serif: serif ? SERIF : 'serif',
        sans: sans || sansBold ? SANS : 'sans-serif',
    };
}

export const formatGroup = (g?: string | null) => (g ? g.replace('-', '−') : '');

/** Shortens text to n characters with an ellipsis. */
export const clip = (s: string | null | undefined, n: number) => {
    const t = (s ?? '').trim();
    return t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t;
};

/** Cache headers for data-driven images: short, so a closed request's preview updates. */
export const DATA_IMAGE_HEADERS = { 'cache-control': 'public, max-age=300, s-maxage=300, stale-while-revalidate=3600' };

// ---------------------------------------------------------------------------
// Blood group mark. The Rh sign is drawn with bars so it never depends on a
// font having a true minus glyph, and reads clearly at thumbnail size.

export function GroupMark({ group, size, color }: { group: string; size: number; color: string }) {
    const letters = group.replace(/[+\-−]/g, '');
    const negative = /[-−]/.test(group);
    const box = Math.round(size * 0.4);
    const bar = Math.max(3, Math.round(size * 0.1));
    return (
        <div style={{ display: 'flex', alignItems: 'flex-start', color, lineHeight: 1 }}>
            <div style={{ display: 'flex', fontSize: size, fontWeight: 800, letterSpacing: -size * 0.04, lineHeight: 1 }}>{letters}</div>
            <div style={{ display: 'flex', position: 'relative', width: box, height: box, marginLeft: Math.round(size * 0.06), marginTop: Math.round(size * 0.1) }}>
                <div style={{ position: 'absolute', left: 0, top: (box - bar) / 2, width: box, height: bar, background: color, borderRadius: bar / 2 }} />
                {!negative && <div style={{ position: 'absolute', top: 0, left: (box - bar) / 2, width: bar, height: box, background: color, borderRadius: bar / 2 }} />}
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Request data for images. Uses the anon key only, so RLS decides what is
// visible (active requests). Never selects contact details.

export type OgRequest = {
    id: string;
    blood_group: string;
    units_needed: number | null;
    hospital_name: string | null;
    city: string | null;
    urgency_level: string | null;
    date_needed: string | null;
    status: string | null;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Returns the request if it is publicly visible and open, otherwise null. */
export async function fetchOpenRequest(id: string): Promise<OgRequest | null> {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key || !UUID_RE.test(id)) return null;
    try {
        const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
        const { data } = await supabase
            .from('blood_requests')
            .select('id, blood_group, units_needed, hospital_name, city, urgency_level, date_needed, status')
            .eq('id', id)
            .maybeSingle();
        const r = data as OgRequest | null;
        // RLS already hides expired requests; checked here too so previews never ask for blood after the date.
        return r && isRequestOpen(r) ? r : null;
    } catch {
        return null;
    }
}

function requestView(r: OgRequest) {
    const urgent = r.urgency_level === 'High';
    const donors = compatibleDonorGroups(r.blood_group);
    return {
        urgent,
        accent: urgent ? OG_COLORS.red : OG_COLORS.ink,
        urgency: (r.urgency_level && URGENCY_LABEL[r.urgency_level]) || 'Blood needed',
        units: unitsLabel(r.units_needed),
        neededBy: formatNeededBy(r.date_needed),
        donors,
        anyDonor: donors.length >= 8,
    };
}

function DonorChips({ donors, size, gap }: { donors: string[]; size: number; gap: number }) {
    if (donors.length >= 8) {
        return (
            <div style={{ display: 'flex', fontSize: size * 0.8, fontWeight: 800, color: OG_COLORS.red }}>Every blood group</div>
        );
    }
    return (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap }}>
            {donors.map(g => (
                <div
                    key={g}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: `${Math.round(size * 0.35)}px ${Math.round(size * 0.55)}px`,
                        borderRadius: Math.round(size * 0.4),
                        background: OG_COLORS.redSoft,
                    }}
                >
                    <GroupMark group={g} size={size} color={OG_COLORS.redDeep} />
                </div>
            ))}
        </div>
    );
}

const label = (size: number, color: string) =>
    ({ display: 'flex', fontSize: size, fontWeight: 800, letterSpacing: size * 0.14, textTransform: 'uppercase', color }) as const;

/**
 * 1200x630 share preview. The blood group, urgency and city sit in the centre panel so a
 * square-cropped WhatsApp thumbnail still shows them.
 */
export function RequestOgCard({ r, f }: { r: OgRequest; f: OgFontSet }) {
    const v = requestView(r);
    const C = OG_COLORS;
    return (
        <div style={{ display: 'flex', width: '100%', height: '100%', background: C.white, color: C.ink, fontFamily: f.sans }}>
            {/* Left: wordmark, units, hospital, date */}
            <div style={{ display: 'flex', flexDirection: 'column', width: 300, padding: '44px 36px 44px 48px' }}>
                <div style={{ display: 'flex', fontFamily: f.serif, fontSize: 52, fontWeight: 600, lineHeight: 1 }}>vital</div>
                <div style={{ display: 'flex', flexDirection: 'column', marginTop: 'auto' }}>
                    {v.units && <div style={{ display: 'flex', fontSize: 46, fontWeight: 800, lineHeight: 1.05, color: v.urgent ? C.red : C.ink }}>{v.units}</div>}
                    {r.hospital_name && (
                        <div style={{ display: 'flex', marginTop: 10, fontSize: 26, lineHeight: 1.25, color: C.ink }}>{`at ${clip(r.hospital_name, 48)}`}</div>
                    )}
                </div>
                {v.neededBy && (
                    <div style={{ display: 'flex', flexDirection: 'column', marginTop: 28, paddingTop: 20, borderTop: `3px solid ${C.line}` }}>
                        <div style={label(16, C.muted)}>Needed by</div>
                        <div style={{ display: 'flex', marginTop: 6, fontSize: 32, fontWeight: 800 }}>{v.neededBy}</div>
                    </div>
                )}
            </div>

            {/* Centre: group, urgency, city */}
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 600,
                    background: v.accent,
                    color: C.white,
                    padding: '40px 32px',
                }}
            >
                <div style={label(24, 'rgba(255,255,255,0.82)')}>Blood needed</div>
                <div style={{ display: 'flex', marginTop: 14 }}>
                    <GroupMark group={r.blood_group} size={196} color={C.white} />
                </div>
                <div
                    style={{
                        display: 'flex',
                        marginTop: 18,
                        padding: '10px 26px',
                        borderRadius: 999,
                        background: C.white,
                        color: v.accent,
                        fontSize: 30,
                        fontWeight: 800,
                        letterSpacing: 2,
                        textTransform: 'uppercase',
                    }}
                >
                    {v.urgency}
                </div>
                {r.city && (
                    <div style={{ display: 'flex', marginTop: 22, fontSize: r.city.length > 14 ? 44 : 52, fontWeight: 800, lineHeight: 1.05, textAlign: 'center' }}>{clip(r.city, 20)}</div>
                )}
            </div>

            {/* Right: compatible donors, site */}
            <div style={{ display: 'flex', flexDirection: 'column', width: 300, padding: '48px 40px 44px 40px' }}>
                <div style={label(16, C.muted)}>Who can donate</div>
                <div style={{ display: 'flex', marginTop: 16 }}>
                    <DonorChips donors={v.donors} size={34} gap={10} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', marginTop: 'auto' }}>
                    <div style={{ display: 'flex', fontSize: 24, fontWeight: 800, lineHeight: 1.2 }}>Can you donate?</div>
                    <div style={{ display: 'flex', marginTop: 6, fontSize: 22, color: C.muted }}>{`Respond on ${SITE_HOST}`}</div>
                </div>
            </div>
        </div>
    );
}

/** 1080x1350 poster for WhatsApp Status and Instagram. */
export function RequestPoster({ r, f }: { r: OgRequest; f: OgFontSet }) {
    const v = requestView(r);
    const C = OG_COLORS;
    const hospital = clip(r.city ? r.hospital_name : [r.hospital_name, r.city].filter(Boolean).join(', '), 70);
    const where = hospital ? (v.units ? `${v.units} at ${hospital}` : `At ${hospital}`) : v.units ? `${v.units} needed` : '';
    return (
        <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', background: C.white, color: C.ink, fontFamily: f.sans }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '48px 64px 32px' }}>
                <div style={{ display: 'flex', fontFamily: f.serif, fontSize: 64, fontWeight: 600, lineHeight: 1 }}>vital</div>
                <div style={label(22, C.muted)}>Blood request</div>
            </div>

            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    margin: '0 64px',
                    padding: '48px 40px 52px',
                    borderRadius: 40,
                    background: v.accent,
                    color: C.white,
                }}
            >
                <div style={{ display: 'flex', padding: '12px 30px', borderRadius: 999, background: C.white, color: v.accent, fontSize: 34, fontWeight: 800, letterSpacing: 3, textTransform: 'uppercase' }}>
                    {v.urgency}
                </div>
                <div style={{ display: 'flex', marginTop: 24 }}>
                    <GroupMark group={r.blood_group} size={320} color={C.white} />
                </div>
                <div style={{ ...label(32, 'rgba(255,255,255,0.88)'), marginTop: 12 }}>Blood needed</div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', padding: '40px 64px 0' }}>
                {r.city && <div style={{ display: 'flex', fontSize: 76, fontWeight: 800, lineHeight: 1.02, letterSpacing: -1 }}>{clip(r.city, 22)}</div>}
                {where && <div style={{ display: 'flex', marginTop: 14, fontSize: 38, lineHeight: 1.25 }}>{where}</div>}
                {v.neededBy && (
                    <div style={{ display: 'flex', marginTop: 14, fontSize: 38, fontWeight: 800, color: v.urgent ? C.red : C.ink }}>{`Needed by ${v.neededBy}`}</div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginTop: 32 }}>
                    <div style={label(20, C.muted)}>Who can donate</div>
                    <DonorChips donors={v.donors} size={36} gap={10} />
                </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', marginTop: 'auto', padding: '32px 64px 44px', background: C.inkSoft }}>
                <div style={{ display: 'flex', fontSize: 40, fontWeight: 800 }}>Can you donate or forward this?</div>
                <div style={{ display: 'flex', marginTop: 8, fontSize: 28, color: C.ink, wordBreak: 'break-all' }}>{`Visit ${SITE_HOST}/requests/${r.id}`}</div>
                <div style={{ display: 'flex', marginTop: 14, fontSize: 20, color: C.muted }}>
                    Vital only connects donors and families. It does not arrange or guarantee donations.
                </div>
            </div>
        </div>
    );
}

/** Shown when a request is missing, private or no longer open. Works at both sizes. */
export function ClosedRequestCard({ f, tall = false }: { f: OgFontSet; tall?: boolean }) {
    const C = OG_COLORS;
    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                width: '100%',
                height: '100%',
                background: C.white,
                color: C.ink,
                fontFamily: f.sans,
                padding: 72,
                textAlign: 'center',
            }}
        >
            <div style={{ display: 'flex', fontFamily: f.serif, fontSize: tall ? 120 : 96, fontWeight: 600, lineHeight: 1 }}>vital</div>
            <div style={{ display: 'flex', width: 96, height: 8, borderRadius: 4, background: C.red, marginTop: tall ? 48 : 32 }} />
            <div style={{ display: 'flex', marginTop: tall ? 48 : 32, fontSize: tall ? 64 : 56, fontWeight: 800, lineHeight: 1.1 }}>This request has been closed</div>
            <div style={{ display: 'flex', marginTop: 20, fontSize: tall ? 36 : 30, color: C.muted }}>{`See open requests on ${SITE_HOST}/requests`}</div>
        </div>
    );
}
