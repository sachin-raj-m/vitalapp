/**
 * "9876543210" / "+91 98765 43210" / "098765 43210" -> "919876543210", the
 * format WhatsApp uses. null if it isn't an Indian mobile number.
 * Mirrors public.wa_number() in the database.
 */
export function waNumber(phone?: string | null): string | null {
    const d = (phone ?? '').replace(/\D/g, '');
    if (/^[6-9]\d{9}$/.test(d)) return `91${d}`;
    if (/^0[6-9]\d{9}$/.test(d)) return `91${d.slice(1)}`;
    if (/^91[6-9]\d{9}$/.test(d)) return d;
    return null;
}

/** "919876543210" -> "+91 98765 43210" for display. */
export const formatWaNumber = (wa: string) => `+${wa.slice(0, 2)} ${wa.slice(2, 7)} ${wa.slice(7)}`;
