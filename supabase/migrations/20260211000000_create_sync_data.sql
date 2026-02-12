-- SessionSync: core table and RPC functions
-- This migration creates the sync_data table and the read/write RPC functions.

------------------------------------------------------------
-- 1. Table
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
-- 2. Read RPC — return rows matching the caller's user_hash
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
-- 3. Write RPC — upsert with write_token verification
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
  -- Input size guards (prevent abuse)
  IF length(p_encrypted_payload) > 5242880 THEN  -- 5 MB
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
