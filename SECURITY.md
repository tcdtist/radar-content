# Security Policy

## Supported Versions

We provide security updates for the following versions of Radar Content:

| Version | Supported          |
| ------- | ------------------ |
| 0.2.x   | :white_check_mark: |
| < 0.2.0 | :x:                |

## Reporting a Vulnerability

Security of user data and serverless isolates is a top priority. If you discover a security vulnerability or sensitive information disclosure in Radar Content, please report it responsibly:

1. **Do not create a public GitHub issue.**
2. Report the vulnerability privately through [GitHub Private Vulnerability Reporting](https://github.com/tcdtist/radar-content/security/advisories/new) via the Security tab.
3. Include:
   - Description of the vulnerability.
   - Steps to reproduce or proof-of-concept.
   - Potential impact.
4. We will acknowledge receipt within 48 hours and provide an estimated fix timeline.
5. Once patched, we will publish an advisory and credit you in the release notes (unless you prefer anonymity).

## Best Practices for Self-Hosting

- **Never commit `.dev.vars`** containing `GEMINI_API_KEY` or any credentials.
- **Use Cloudflare Workers Secrets** (`wrangler secret put GEMINI_API_KEY`) for all production secrets.
- **Isolate your D1 database** and do not share database credentials across public repositories.
