/**
 * Request columns a signed-out visitor may read. user_id is deliberately absent:
 * the anon role has no SELECT on it (migration 20261008000600), so selecting
 * '*' as a visitor fails. Signed-in queries may add user_id.
 */
export const REQUEST_PUBLIC_COLUMNS =
    'id, blood_group, units_needed, hospital_name, hospital_address, urgency_level, notes, contact_name, location, status, created_at, updated_at, city, zipcode, date_needed';

type Dated = { date_needed?: string | null };

/** True once the needed-by date has passed (the request is then treated as closed). */
export const isPastNeededBy = (r: Dated) =>
    !!r.date_needed && r.date_needed < new Date().toISOString().slice(0, 10);

/** Open = active and not past its needed-by date. Mirrors the database rule. */
export const isRequestOpen = (r: Dated & { status?: string | null }) =>
    r.status === 'active' && !isPastNeededBy(r);
