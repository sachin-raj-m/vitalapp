const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Public profile path, e.g. /donor/AnjaliMenon@1042. */
export function donorProfilePath(user: { full_name?: string | null; donor_number?: number | null; id: string }) {
    const cleanName = (user.full_name || 'Donor').replace(/[^a-zA-Z0-9]/g, '');
    return `/donor/${cleanName}@${user.donor_number || user.id}`;
}

/** Parses a vanity slug ("Name@1042" or "Name@<uuid>") back into a lookup key. */
export function parseDonorSlug(slug: string): { lookupId: string; isUuid: boolean; isDonorNumber: boolean } | null {
    let lookupId = slug;

    if (slug.includes('@')) {
        const parts = slug.split('@');
        lookupId =
            parts.find(p => /^\d+$/.test(p)) ||
            parts.find(p => UUID_RE.test(p)) ||
            parts[parts.length - 1];
    }

    const isUuid = UUID_RE.test(lookupId);
    const isDonorNumber = /^\d+$/.test(lookupId);
    if (!isUuid && !isDonorNumber) return null;

    return { lookupId, isUuid, isDonorNumber };
}
