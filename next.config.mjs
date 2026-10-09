const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseHost = supabaseUrl ? new URL(supabaseUrl).host : '';
const isDev = process.env.NODE_ENV === 'development';

// Enforced by default. Escape hatch: CSP_REPORT_ONLY=true sends the same policy
// as Content-Security-Policy-Report-Only (violations are logged, nothing blocked).
// Covers everything the app loads today: self-hosted next/font fonts, OSM map
// tiles, Supabase REST/auth/realtime. Google OAuth is a top-level navigation and
// OG images are same-origin. Adding a new third-party origin means adding it here.
const csp = [
  "default-src 'self'",
  // Next.js injects inline bootstrap scripts; nonces would remove 'unsafe-inline'.
  // React Refresh in `next dev` needs eval.
  // challenges.cloudflare.com: Turnstile bot check on the auth forms.
  `script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com${isDev ? " 'unsafe-eval'" : ''}`,
  // Leaflet marker HTML and React style props use inline styles.
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://tile.openstreetmap.org",
  "font-src 'self'",
  `connect-src 'self'${supabaseHost ? ` https://${supabaseHost} wss://${supabaseHost}` : ''}${isDev ? ' ws: http://localhost:* http://127.0.0.1:*' : ''}`,
  "worker-src 'self'",
  "manifest-src 'self'",
  "frame-src https://challenges.cloudflare.com",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
].join('; ');

// Without the Supabase host, connect-src would block every API call: never enforce that.
if (!supabaseHost) console.warn('NEXT_PUBLIC_SUPABASE_URL is not set; CSP falls back to Report-Only.');
const cspHeader = process.env.CSP_REPORT_ONLY === 'true' || !supabaseHost
  ? 'Content-Security-Policy-Report-Only'
  : 'Content-Security-Policy';

const securityHeaders = [
  { key: cspHeader, value: csp },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'geolocation=(self), camera=(), microphone=(), payment=(), usb=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
    ],
  },
  turbopack: {},
  async redirects() {
    return [
      // The page was renamed from Achievements to Milestones; keep old links working.
      { source: '/achievements', destination: '/milestones', permanent: true },
    ];
  },
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      // The service worker must never be served stale.
      { source: '/sw.js', headers: [{ key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' }] },
    ];
  },
};

export default nextConfig;
