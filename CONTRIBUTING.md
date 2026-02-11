# Contributing to SessionSync

Thanks for your interest in contributing! Here's how to get started.

## Development Setup

```bash
# Clone the repo
git clone https://github.com/tageecc/session-sync.git
cd session-sync

# Install dependencies
npm install

# Copy env and fill in your Supabase credentials
cp .env.example .env

# Dev build (watch mode)
npm run dev
```

Load the `dist` folder as an unpacked extension in `chrome://extensions/`.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Build in watch mode (development) |
| `npm run build` | Type-check + production build |
| `npm run lint` | Run ESLint |
| `npm run type-check` | TypeScript type check only |

## Pull Request Guidelines

1. **Fork & branch** — create a feature branch from `master`.
2. **Keep it focused** — one logical change per PR.
3. **Follow existing style** — the project uses TypeScript strict mode and ESLint.
4. **Test manually** — load the extension and verify push/pull works.
5. **Update docs** — if you change behavior, update README and locale files accordingly.

## Commit Messages

Use concise, descriptive messages. Examples:

- `fix: handle expired cookies during pull`
- `feat: add data expiration option`
- `docs: update Supabase setup SQL`

## Reporting Bugs

Open an issue with:

- Browser version
- Extension version
- Steps to reproduce
- Expected vs actual behavior

## Security Vulnerabilities

Please **do not** open public issues for security vulnerabilities. See [SECURITY.md](SECURITY.md) for responsible disclosure instructions.

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
