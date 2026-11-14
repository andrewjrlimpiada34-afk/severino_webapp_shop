# Contributing

Start with the [README](README.md) for setup, the
[repository map](docs/REPOSITORY_MAP.md) for file locations, and
[TESTCMD.md](TESTCMD.md) for existing checks.

## Issues

Use the bug report template for reproducible problems and the feature request
template for proposed improvements. Include the affected area, expected result,
and enough detail for another person to understand the request.

For screenshots, logs, and reproduction data, remove passwords, OTPs, tokens,
database URLs, and customer information. Report suspected vulnerabilities
privately to the repository maintainer instead of posting exploit details or
credentials in a public issue.

## Making a change

1. Create a focused branch, such as `docs/setup-guide`, `fix/cart-validation`,
   or `feat/product-filter`.
2. Keep each pull request focused on one problem. For an organization-only
   change, edit documentation and templates without moving source files or
   changing application behavior.
3. Follow the patterns already used in the affected folder. Frontend components
   and pages use PascalCase filenames; JavaScript regression tests live beside
   their implementation as `*.test.js`.
4. Update related documentation when setup, behavior, or commands change.
5. Review the diff, run the relevant checks, and open a pull request using the
   provided template.

## Validation

- **Documentation and templates:** check relative links, file paths, code blocks,
  and command working directories. Application tests are optional when behavior
  and runtime configuration are unchanged.
- **JavaScript behavior:** run the affected Node tests from
  [TESTCMD.md](TESTCMD.md), plus lint and build checks when relevant.
- **Python OTP behavior:** run the Python unittest command. State whether live
  delivery was also tested; mocked tests do not verify a sender's credentials.
- **UI behavior or layout:** run the relevant browser QA script and inspect
  desktop/mobile screenshots.

In the pull request, record the exact commands run and their outcomes. Explain
any failures, skipped checks, or environment limitations.

## Commits and pull requests

Continue the repository's descriptive commit style:

```text
docs: improve setup and testing guides
fix(checkout): validate delivery contact details
feat(storefront): add product filtering
```

Before staging, inspect `git status --short`. Stage explicit paths when the
working tree contains unrelated changes. Review `git diff --cached` before
committing so existing asset deletions or local artifacts are not included by
accident.

The existing `npm run deploy` script stages every change, commits, and pushes.
For a focused documentation update, use explicit Git staging commands instead.

## Local files

Keep `.env` files, Gmail credential JSON, refresh tokens, private keys, and
database passwords local. Also leave `node_modules/`, `.venv-otp/`, `dist/`,
`tmp/`, and `deliverables/` out of commits; these are generated or local files
covered by the repository's ignore rules.

Use GitHub Issues to track remaining work. Include acceptance criteria and link
the issue from the implementing pull request.
