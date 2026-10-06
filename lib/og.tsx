// Shared bits for the dynamic OpenGraph images (edge runtime).

export const OG_SIZE = { width: 1200, height: 630 };

export const OG_COLORS = {
    paper: '#FAF8F5',
    ink: '#1B1815',
    muted: '#7E776E',
    line: '#E7E2DA',
    red: '#B5161B',
};

/** Fetches Instrument Serif from Google Fonts. Returns null if unavailable so images still render. */
export async function loadSerif(): Promise<ArrayBuffer | null> {
    try {
        const css = await fetch('https://fonts.googleapis.com/css2?family=Instrument+Serif', {
            // An old UA makes Google return a TTF, which Satori can read.
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 6.1) AppleWebKit/534.30 (KHTML, like Gecko)' },
        }).then(r => r.text());
        const url = css.match(/src: url\((.+?)\) format/)?.[1];
        if (!url) return null;
        return await fetch(url).then(r => r.arrayBuffer());
    } catch {
        return null;
    }
}

export const ogFonts = (serif: ArrayBuffer | null) =>
    serif ? [{ name: 'Instrument Serif', data: serif, style: 'normal' as const, weight: 400 as const }] : undefined;

export const formatGroup = (g?: string | null) => (g ? g.replace('-', '−') : '');
