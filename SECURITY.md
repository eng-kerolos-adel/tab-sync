# Security Policy

## Reporting a vulnerability

Please **do not** open a public issue for security problems. Use GitHub's
private reporting: **Security → Report a vulnerability** on this repository.
You can expect an acknowledgement within a few days.

## Scope and threat model

`tab-sync` synchronizes **UI state** between tabs of the same origin.

- It is **not** an authentication or authorization mechanism. Session lifetime
  and permissions must always be enforced on the server.
- Messages are visible to any script running on the same origin (including
  third-party scripts or injected XSS). Never send or persist tokens,
  passwords or other secrets through it.
- Treat every received `payload` as untrusted input and validate it before use.
