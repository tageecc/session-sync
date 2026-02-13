# Privacy Policy — SessionSync

**Last updated: February 11, 2026**

SessionSync ("the Extension") is a browser extension that synchronizes browser session data (cookies, localStorage, sessionStorage) between devices using end-to-end encryption. This privacy policy explains what data is collected, how it is used, and your rights.

## 1. Data We Collect

### 1.1 Session Data (User-Initiated Only)

When you explicitly click **Push**, the Extension reads the following data from the **current active tab only**:

- Cookies associated with the current site
- localStorage entries of the current site
- sessionStorage entries of the current site

This data is **encrypted in your browser** before being transmitted. The server never has access to the plaintext.

### 1.2 Sync Key Derivative

A cryptographic hash (`user_hash`) derived from your sync key is used as a database lookup identifier. The sync key itself is never transmitted to any server.

### 1.3 No Personal Information

The Extension does **not** collect:

- Names, email addresses, or any personally identifiable information (PII)
- Browsing history or activity beyond the current tab when you click Push
- Analytics, telemetry, or usage tracking data
- IP addresses (beyond what is inherent in any network request)

## 2. How Data Is Stored

| Data | Location | Encryption |
|------|----------|------------|
| Sync key | Local device only (`chrome.storage.local`) | Not transmitted |
| Encrypted session payload | Supabase cloud database | AES-256-GCM (end-to-end) |
| `user_hash` | Supabase cloud database | HMAC-SHA-256 hash (irreversible) |
| `write_token` | Supabase cloud database | HMAC-SHA-256 hash (irreversible) |

All data stored on the server is encrypted ciphertext. The server operator cannot read, decrypt, or reconstruct the original session data.

## 3. How Data Is Used

- **Sync**: Encrypted data is stored and retrieved solely to enable cross-device session synchronization.
- **Write protection**: The `write_token` is used to prevent unauthorized modification of your data.
- **No advertising**: Your data is never used for advertising, profiling, or sold to third parties.

## 4. Data Sharing

We do **not** share, sell, or transfer your data to any third party, except:

- **Supabase** (infrastructure provider): Hosts the encrypted data. Supabase cannot decrypt it. See [Supabase Privacy Policy](https://supabase.com/privacy). Self-hosted users use their own Supabase instance.

## 5. Data Retention & Deletion

- Your encrypted data is stored as long as your sync key is active.
- You may delete your data at any time by discontinuing use of the sync key. Data associated with unused keys may be periodically purged.
- Self-hosted users control their own data retention policies.

## 6. Permissions Explained

| Permission | Why It's Needed |
|------------|-----------------|
| `cookies` | Read/write cookies for the current site during Push/Pull |
| `storage` | Store your sync key and settings locally |
| `activeTab` | Detect the current tab's URL to identify which site to sync |
| `tabs` | Get the current tab's URL for site identification |
| `scripting` | Inject content script on-demand to read/write page storage |
| `<all_urls>` | Allow content script injection on any site you choose to sync |

## 7. Security

- **End-to-end encryption**: AES-256-GCM with PBKDF2 key derivation (600,000 iterations)
- **Open source**: The Extension's source code is publicly auditable at [github.com/tageecc/session-sync](https://github.com/tageecc/session-sync)
- **Zero-knowledge server**: The server only stores ciphertext and cryptographic hashes

## 8. Children's Privacy

This Extension is not intended for use by children under 13. We do not knowingly collect data from children.

## 9. Changes to This Policy

We may update this policy from time to time. Changes will be posted in the Extension's repository and reflected in the "Last updated" date above.

## 10. Contact

If you have questions about this privacy policy, please open an issue at [github.com/tageecc/session-sync/issues](https://github.com/tageecc/session-sync/issues).
