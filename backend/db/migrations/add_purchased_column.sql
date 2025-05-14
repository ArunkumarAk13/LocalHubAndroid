-- Add purchased column to posts table
ALTER TABLE posts ADD COLUMN IF NOT EXISTS purchased BOOLEAN DEFAULT FALSE; 