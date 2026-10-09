import * as Sentry from '@sentry/nextjs';
import { sentryOptions } from '@/lib/monitoring';

// Server and edge errors -> GlitchTip. See lib/monitoring.ts.
export function register() {
    Sentry.init(sentryOptions);
}

// Errors thrown while rendering pages or handling route requests.
export const onRequestError = Sentry.captureRequestError;
