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
| `user_hash` | Database lookup | HMAC-SHA-256(key, `session-sync:user-id`) |
| `write_token` | Write authorization | HMAC-SHA-256(key, `session-sync:write-token`) |
| AES key | Encrypt / decrypt data | PBKDF2(key, random_salt) → AES-256-GCM |

---

## Usage

### Option A: Install from Chrome Web Store (Recommended)

> **Coming soon** — [SessionSync on Chrome Web Store](#)
>
> Install the extension directly. The default shared cloud backend is included — no setup required.

### Option B: Self-Host (Build from Source)

If you prefer to run your own backend, follow the steps below.

#### 1. Create a Supabase project

Go to [supabase.com](https://supabase.com), create a project, and grab the **URL** and **anon key** from Settings → API.

#### 2. Set up environment variables

```bash
cp .env.example .env
```

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

#### 3. Initialize the database

Copy the SQL from [`supabase/schema.sql`](supabase/schema.sql) and run it in the [Supabase SQL Editor](https://supabase.com/dashboard/project/_/sql).

#### 4. Build the extension

```bash
pnpm install
pnpm run build
```

#### 5. Load in Chrome

Open `chrome://extensions/` → Enable **Developer Mode** → **Load Unpacked** → select the `dist` folder.

---

## Database Schema

All public SQL is in a single file: [`supabase/schema.sql`](supabase/schema.sql)

- **`sync_data`** table — stores encrypted session payloads per user per origin
- **`read_sync_data()`** — reads encrypted data by `user_hash` + `origin`
- **`upsert_sync_data()`** — writes with `write_token` verification and size limits
- **`list_user_origins()`** — lists all synced origins for a user
- **`delete_sync_data()`** — removes a synced origin (requires `write_token`)

## Project Structure

```
├── src/
│   ├── shared/
│   │   ├── crypto.ts           # Key generation + E2EE (AES-256-GCM)
│   │   ├── config.ts           # Config persistence (chrome.storage)
│   │   ├── supabaseClient.ts   # Supabase client factory
│   │   ├── messaging.ts        # Extension message passing
│   │   ├── i18n.ts             # Internationalization helper
│   │   └── toast.ts            # Toast notification utility
│   ├── background/index.ts     # Push / Pull via Supabase RPC
│   ├── content/index.ts        # Read/write page storage
│   ├── popup/                  # Popup UI
│   ├── options/                # Settings page
│   └── manifest.json
├── supabase/
│   └── schema.sql              # Database schema (public)
└── public/
    └── _locales/               # i18n messages (en, zh_CN)
```

## Tech Stack

Manifest V3 · TypeScript · Vite · CRXJS · Tailwind CSS · Supabase · Web Crypto API

## License

[MIT](LICENSE)
