-- Add city and zipcode columns to blood_requests table
ALTER TABLE blood_requests
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS zipcode TEXT;

-- Create an index for faster filtering
CREATE INDEX IF NOT EXISTS idx_blood_requests_city ON blood_requests(city);
CREATE INDEX IF NOT EXISTS idx_blood_requests_zipcode ON blood_requests(zipcode);
