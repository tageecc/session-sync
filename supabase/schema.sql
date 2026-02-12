-- ============================================================
-- SessionSync — Public Database Schema
-- Run this SQL in Supabase SQL Editor (or via psql) to set up
-- the backend for self-hosted deployments.
-- ============================================================

------------------------------------------------------------
-- 1. Core table
------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sync_data (
  id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_hash         TEXT NOT NULL,
  origin            TEXT NOT NULL,
  encrypted_payload TEXT NOT NULL,
  iv                TEXT NOT NULL,
  salt              TEXT NOT NULL,
  write_token       TEXT NOT NULL,
  created_at        TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at        TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(user_hash, origin)
);

-- RLS: deny all direct access; data is only accessible through RPC functions
ALTER TABLE sync_data ENABLE ROW LEVEL SECURITY;

------------------------------------------------------------
-- 2. Read — return encrypted data for a specific origin
------------------------------------------------------------
CREATE OR REPLACE FUNCTION read_sync_data(
  p_user_hash TEXT,
  p_origin    TEXT
) RETURNS TABLE (encrypted_payload TEXT, iv TEXT, salt TEXT)
  LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT encrypted_payload, iv, salt
  FROM sync_data
  WHERE user_hash = p_user_hash AND origin = p_origin
  ORDER BY updated_at DESC
  LIMIT 1;
$$;

------------------------------------------------------------
-- 3. Write — upsert with write_token verification
------------------------------------------------------------
CREATE OR REPLACE FUNCTION upsert_sync_data(
  p_user_hash         TEXT,
  p_origin            TEXT,
  p_encrypted_payload TEXT,
  p_iv                TEXT,
  p_salt              TEXT,
  p_write_token       TEXT
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF length(p_encrypted_payload) > 5242880 THEN
    RAISE EXCEPTION 'payload too large';
  END IF;
  IF length(p_origin) > 2048 THEN
    RAISE EXCEPTION 'origin too long';
  END IF;

  IF EXISTS (SELECT 1 FROM sync_data WHERE user_hash = p_user_hash AND origin = p_origin) THEN
    IF NOT EXISTS (
      SELECT 1 FROM sync_data
      WHERE user_hash = p_user_hash AND origin = p_origin AND write_token = p_write_token
    ) THEN
      RAISE EXCEPTION 'write_token mismatch';
    END IF;
    UPDATE sync_data SET
      encrypted_payload = p_encrypted_payload,
      iv                = p_iv,
      salt              = p_salt,
      updated_at        = now()
    WHERE user_hash = p_user_hash AND origin = p_origin;
  ELSE
    INSERT INTO sync_data (user_hash, origin, encrypted_payload, iv, salt, write_token)
    VALUES (p_user_hash, p_origin, p_encrypted_payload, p_iv, p_salt, p_write_token);
  END IF;
END;
$$;

------------------------------------------------------------
-- 4. List — all synced origins for a user
------------------------------------------------------------
CREATE OR REPLACE FUNCTION list_user_origins(p_user_hash TEXT)
RETURNS TABLE (origin TEXT, updated_at TIMESTAMPTZ)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT origin, updated_at
  FROM sync_data
  WHERE user_hash = p_user_hash
  ORDER BY updated_at DESC;
$$;

------------------------------------------------------------
-- 5. Delete — remove a synced origin (requires write_token)
------------------------------------------------------------
CREATE OR REPLACE FUNCTION delete_sync_data(
  p_user_hash   TEXT,
  p_origin      TEXT,
  p_write_token TEXT
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM sync_data
    WHERE user_hash = p_user_hash AND origin = p_origin AND write_token = p_write_token
  ) THEN
    RAISE EXCEPTION 'write_token mismatch';
  END IF;

  DELETE FROM sync_data
  WHERE user_hash = p_user_hash AND origin = p_origin;
END;
$$;
