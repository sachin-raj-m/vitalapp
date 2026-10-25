/*
  # A request needs 1 to 20 units

  The request form and the WhatsApp flow both limit units to 1–20; the
  database now enforces the same range for every client (donation units already
  are 1–20).
*/
ALTER TABLE public.blood_requests DROP CONSTRAINT IF EXISTS blood_requests_units_range;
ALTER TABLE public.blood_requests
  ADD CONSTRAINT blood_requests_units_range CHECK (units_needed BETWEEN 1 AND 20);
