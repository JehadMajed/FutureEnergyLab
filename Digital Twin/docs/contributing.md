# Contributing

Thank you for your interest in contributing to the NB2 Lamps Panel Digital Twin!

---

## Getting Started

1. **Fork** the repository on GitHub
2. **Clone** your fork locally
3. Follow the setup steps in the [README](../README.md#quick-start-local-dev)
4. Create a new branch for your change

---

## Branch Naming

| Type | Pattern | Example |
|---|---|---|
| Feature | `feat/short-description` | `feat/export-png-chart` |
| Bug fix | `fix/short-description` | `fix/mqtt-reconnect-loop` |
| Documentation | `docs/short-description` | `docs/update-architecture` |
| Refactor | `refactor/short-description` | `refactor/simulation-engine` |

---

## Code Style

- **Vanilla JS only** — no frontend frameworks, no bundlers for client code
- Use `const` / `let`, never `var`
- Prefer descriptive variable names over comments
- Keep functions focused and ≤ 50 lines where practical
- CSS: follow the BEM-like naming already in `style.css`

---

## Pull Request Process

1. Open a PR against the `main` branch
2. Fill out the PR template
3. Ensure the 3D model viewer, charts, and simulation still work locally
4. Link any related issue (e.g. `Closes #42`)

---

## Reporting Bugs

Use the **Bug Report** issue template. Please include:
- Browser + OS
- Steps to reproduce
- What you expected vs. what happened
- Console errors (if any)

---

## Security Issues

**Do not open a public issue for security vulnerabilities.**  
See [SECURITY.md](../SECURITY.md) for responsible disclosure instructions.

---

## Academic Use

If you use this project in academic work, please cite it:

> Jehad Majed, *NB2 Lamps Panel Digital Twin*, Prince Sattam bin Abdulaziz University, 2025.
> GitHub: https://github.com/YOUR_USERNAME/digital-twin-lamps-panel
