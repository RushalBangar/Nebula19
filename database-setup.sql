-- =====================================================
-- Real-time Chat Application - Database Setup
-- =====================================================
-- Run this SQL in your Supabase SQL Editor

-- 1. Create the messages table
CREATE TABLE IF NOT EXISTS messages (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  room_code TEXT NOT NULL,
  user_email TEXT NOT NULL,
  content TEXT NOT NULL,
  user_id UUID DEFAULT auth.uid()
);

-- 2. Enable Row Level Security
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- 3. Create Policy: Authenticated users can do everything
CREATE POLICY "Authenticated users can do everything"
ON messages
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- 4. Create an index on room_code for better query performance
CREATE INDEX IF NOT EXISTS idx_messages_room_code ON messages(room_code);

-- 5. Create an index on created_at for ordering
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
