# Security Policy

## Supported Versions

| Version | Supported |
|---|---|
| 0.4.x (latest CE release) | ✅ |
| < 0.4.0 | ❌ upgrade to the latest release |

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public issues.**

Use GitHub private vulnerability reporting (repository Security tab → Report a vulnerability), or contact the maintainer directly. Please include:

- Type of issue (e.g. SQL injection, XSS, broken access control, information disclosure)
- Steps to reproduce / PoC
- Affected versions and deployment mode (Docker Compose / source)
- Suggested fix, if any

We will acknowledge receipt within **3 business days**, provide an initial assessment within **7 days**, and keep the reporter updated on fix progress.

## Deployment Hardening Notes

- Always change `YH_JWT_SECRET` in production (generate with `openssl rand -hex 32`); never keep the template default.
- Restrict the `/api/v1/p/*` platform API (EE/SaaS) behind an IP allowlist before exposing it.
- Never commit real secrets from `.env` or `config/*.yaml` to the repository or images.

---

[中文版本 (Chinese version)](SECURITY_ZH.md)
