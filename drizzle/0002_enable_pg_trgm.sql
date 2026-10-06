-- Trigram matching for typo-tolerant product search ("hodie" → "hoodie").
-- pg_trgm is a trusted extension, so the database owner can enable it.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
