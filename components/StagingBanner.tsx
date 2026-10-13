/**
 * Shown on staging.vitalapp.in (NEXT_PUBLIC_APP_ENV=staging, set on the
 * vitalapp-staging Vercel project) so nobody mistakes the public test site for
 * the real service.
 */
export function StagingBanner() {
    if (process.env.NEXT_PUBLIC_APP_ENV !== 'staging') return null;
    return (
        <aside aria-label="Staging notice" className="bg-warning-500 px-4 py-1.5 text-center text-[13px] font-medium text-gray-900">
            Staging site with test data. Nothing here is real. For real requests, use{' '}
            <a href="https://vitalapp.in" className="underline underline-offset-2">vitalapp.in</a>.
        </aside>
    );
}
