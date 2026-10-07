// Routes that render inside the app sidebar instead of the public header/footer.
const APP_PREFIXES = ['/dashboard', '/admin', '/profile', '/nearby-donors', '/milestones', '/donations'];

export const isAppRoute = (pathname: string | null) =>
    !!pathname && APP_PREFIXES.some(p => pathname.startsWith(p));

// Requests are public, but logged-in users see them inside the sidebar.
export const isHybridRoute = (pathname: string | null) => !!pathname?.startsWith('/requests');

// The public donor card has its own minimal chrome.
export const isStandaloneRoute = (pathname: string | null) => !!pathname?.startsWith('/donor');
