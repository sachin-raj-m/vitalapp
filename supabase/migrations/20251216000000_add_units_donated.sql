-- Add units_donated column to donations table
ALTER TABLE donations 
ADD COLUMN IF NOT EXISTS units_donated INTEGER DEFAULT 0;

-- Optionally, we can update existing completed donations to 1 if we assume they gave 1 unit
UPDATE donations SET units_donated = 1 WHERE status = 'completed' AND units_donated = 0;
