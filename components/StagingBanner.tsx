/**
 * Shown on staging.vitalapp.in (Vercel preview builds) so nobody mistakes the
 * public test site for the real service.
 */
export function StagingBanner() {
    if (process.env.NEXT_PUBLIC_VERCEL_ENV !== 'preview') return null;
    return (
        <aside aria-label="Staging notice" className="bg-warning-500 px-4 py-1.5 text-center text-[13px] font-medium text-gray-900">
            Staging site with test data. Nothing here is real. For real requests, use{' '}
            <a href="https://vitalapp.in" className="underline underline-offset-2">vitalapp.in</a>.
        </aside>
    );
}
