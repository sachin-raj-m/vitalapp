import * as Sentry from '@sentry/nextjs';
import { sentryOptions } from '@/lib/monitoring';

// Browser errors -> /api/monitoring -> GlitchTip. See lib/monitoring.ts.
Sentry.init({
    ...sentryOptions,
    tunnel: '/api/monitoring',
    integrations: [],
    beforeBreadcrumb(crumb) {
        // Console noise and UI clicks aren't needed to debug and can contain personal data.
        return crumb.category === 'console' || crumb.category === 'ui.click' || crumb.category === 'ui.input' ? null : crumb;
    },
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
