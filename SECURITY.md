# Security Policy

## Encryption Overview

SessionSync uses end-to-end encryption. All data is encrypted in the browser before being uploaded to the server. The server only stores ciphertext and cannot access your plaintext data.

| Component | Algorithm |
|-----------|-----------|
| Key derivation | PBKDF2 with 600,000 iterations + SHA-256 |
| Encryption | AES-256-GCM with random IV and salt |
| User identifier | HMAC-SHA-256 with domain-separated context |
| Write authorization | HMAC-SHA-256 with domain-separated context |

The sync key provides 120 bits of entropy (24 characters from a 32-char alphabet), exceeding the NIST 112-bit minimum recommendation.

## Permissions

| Permission | Reason |
|------------|--------|
| `cookies` | Read and write cookies for session sync |
| `storage` | Store the sync key and config locally |
| `activeTab` / `tabs` | Access the current tab's URL and cookies |
| `scripting` | Inject content script on-demand to read/write page storage |
| `<all_urls>` (host) | Read/write `localStorage` and `sessionStorage` on any page |

The content script is injected on-demand only when the user explicitly triggers Push or Pull. It does not run in the background or collect data automatically.

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly:

1. **Do not** open a public GitHub issue.
2. Email: **[tageecc@gmail.com]**.
3. Include a detailed description, steps to reproduce, and potential impact.
4. You will receive a response within **72 hours**.

We appreciate responsible disclosure and will credit reporters (unless anonymity is preferred).

## Scope

The following are in scope for security reports:

- Encryption weaknesses or key leakage
- Unauthorized data access or modification
- Content script injection or XSS
- Privacy leaks (metadata, browsing history, etc.)

Out of scope:

- Denial of service on the shared cloud backend
- Social engineering attacks
- Issues in third-party dependencies (please report upstream)
