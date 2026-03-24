-- =====================================================
-- Real-time Chat Application - Advanced Features DB Update
-- =====================================================
-- Run this SQL in your Supabase SQL Editor to prepare for the new features.

-- 1. Add new columns to the existing 'messages' table
ALTER TABLE messages
ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS image_url TEXT,
ADD COLUMN IF NOT EXISTS reactions JSONB DEFAULT '{}'::jsonb;

-- 2. Create the Storage Bucket for Chat Images
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-images', 'chat-images', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Set up Row Level Security (RLS) Policies for the 'chat-images' bucket
-- These policies must target the `storage.objects` table.



-- Allow public read access to images
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING (bucket_id = 'chat-images');

-- Allow securely authenticated users to upload new images
CREATE POLICY "Authenticated users can upload images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'chat-images');

-- Allow authenticated users to delete only their own uploaded images
CREATE POLICY "Users can delete their own images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'chat-images' AND auth.uid() = owner);
