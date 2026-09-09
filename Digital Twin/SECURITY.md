# Security Policy

## Responsible Disclosure

If you discover a security vulnerability in this project — including but not limited to:

- Hardcoded credentials or secrets
- API endpoint misconfigurations
- Authentication bypass issues
- Cross-site scripting (XSS) or injection vulnerabilities

**Please do NOT open a public GitHub issue.**

Instead, contact the maintainer directly:

**Jehad Majed**  
📧 Contact via GitHub: [@JehadMajed](https://github.com/YOUR_USERNAME)

Please include:
1. A description of the vulnerability
2. Steps to reproduce it
3. The potential impact

You will receive a response within **72 hours**. We appreciate responsible disclosure and will credit reporters in the fix commit.

---

## Scope

This policy applies to:
- The code in this repository
- The deployed Cloudflare Pages application

This policy does **not** apply to:
- Third-party services (HiveMQ, EMQX, Cloudflare, Home Assistant) — report those to their respective teams
- The physical hardware panel

---

## Known Security Decisions

| Decision | Rationale |
|---|---|
| MQTT credentials served via `/api/mqtt-config` | Prevents credentials from being embedded in the public JS bundle; served only to authenticated browser sessions |
| HA token used only server-side | Never sent to or stored in the browser |
| `Cache-Control: private` on `/api/mqtt-config` | Prevents CDN caching of credential-bearing responses |
