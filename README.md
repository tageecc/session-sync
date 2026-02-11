# SessionSync

> End-to-end encrypted cross-device browser session sync. No registration required.

[中文文档](README.zh-CN.md)

## Features

- **Zero Registration** — System-generated random key, no email or account needed
- **End-to-End Encrypted** — AES-256-GCM with PBKDF2 (600K iterations), server only stores ciphertext
- **Write-Protected** — All writes go through an RPC function that verifies a `write_token`; no one can tamper with or delete another user's data
- **Self-Hostable** — Uses a shared cloud by default, or configure your own Supabase instance
- **Open Source** — Fully transparent, auditable code

## How It Works

One key derives three independent values:

| Derived Value | Purpose | Algorithm |
|---------------|---------|-----------|
| `user_hash` | Database lookup | SHA-256(key) |
| `write_token` | Write authorization | SHA-256(`session-sync:write:` + key) |
| AES key | Encrypt / decrypt data | PBKDF2(key, random_salt) → AES-256-GCM |

## Quick Start

1. Create a project on [Supabase](https://supabase.com), grab the **URL** and **anon key** from Settings → API

2. Copy and fill in your environment variables

```bash
cp .env.example .env
```

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

3. Run the [setup SQL](#supabase-setup-sql) in the Supabase SQL Editor

4. Build the extension

```bash
npm install
npm run build
```

5. Open `chrome://extensions/` → Enable Developer Mode → Load Unpacked → select the `dist` folder

## Supabase Setup SQL

```sql
CREATE TABLE sync_data (
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

-- Read: only return rows matching the caller's user_hash
CREATE OR REPLACE FUNCTION read_sync_data(
  p_user_hash TEXT,
  p_origin TEXT
) RETURNS TABLE (encrypted_payload TEXT, iv TEXT, salt TEXT)
  LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT encrypted_payload, iv, salt
  FROM sync_data
  WHERE user_hash = p_user_hash AND origin = p_origin
  ORDER BY updated_at DESC
  LIMIT 1;
$$;

-- Write: upsert with write_token verification and input size limits
CREATE OR REPLACE FUNCTION upsert_sync_data(
  p_user_hash TEXT, p_origin TEXT,
  p_encrypted_payload TEXT, p_iv TEXT, p_salt TEXT,
  p_write_token TEXT
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
      encrypted_payload = p_encrypted_payload, iv = p_iv, salt = p_salt, updated_at = now()
    WHERE user_hash = p_user_hash AND origin = p_origin;
  ELSE
    INSERT INTO sync_data (user_hash, origin, encrypted_payload, iv, salt, write_token)
    VALUES (p_user_hash, p_origin, p_encrypted_payload, p_iv, p_salt, p_write_token);
  END IF;
END;
$$;
```

## Project Structure

```
src/
├── shared/
│   ├── crypto.ts           # Key generation + E2EE (AES-256-GCM)
│   ├── config.ts           # Config persistence (chrome.storage)
│   ├── supabaseClient.ts   # Supabase client factory
│   ├── messaging.ts        # Extension message passing
│   ├── i18n.ts             # Internationalization helper
│   └── toast.ts            # Toast notification utility
├── background/index.ts     # Push / Pull via Supabase RPC
├── content/index.ts        # Read/write page storage
├── popup/                  # Popup UI
├── options/                # Settings page
└── manifest.json
```

## Tech Stack

Manifest V3 · TypeScript · Vite · CRXJS · Tailwind CSS · Supabase · Web Crypto API

## License

[MIT](LICENSE)
