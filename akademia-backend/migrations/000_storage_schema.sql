-- Migration 000: Supabase-compatible storage metadata tables.
-- These tables allow the SQL migrations to run on standard PostgreSQL
-- instances, including Render, where Supabase's storage schema is absent.

CREATE SCHEMA IF NOT EXISTS storage;

CREATE TABLE IF NOT EXISTS storage.buckets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  owner TEXT,
  public BOOLEAN NOT NULL DEFAULT FALSE,
  file_size_limit BIGINT,
  allowed_mime_types TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS storage.objects (
  id TEXT PRIMARY KEY,
  bucket_id TEXT NOT NULL REFERENCES storage.buckets(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  owner TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_accessed_at TIMESTAMPTZ,
  metadata JSONB,
  version TEXT,
  path_tokens TEXT[],
  UNIQUE(bucket_id, name)
);

CREATE INDEX IF NOT EXISTS idx_storage_objects_bucket_id
  ON storage.objects(bucket_id);

CREATE INDEX IF NOT EXISTS idx_storage_objects_owner
  ON storage.objects(owner);
