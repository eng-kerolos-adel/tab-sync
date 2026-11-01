# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/) and the project uses [Semantic Versioning](https://semver.org/).

## [1.0.0] - 2026-11-01

### Added
- `createTabSync`: typed message channel on top of `BroadcastChannel` with `emit`, `on`, `onAny` and `close`.
- `createSyncedState`: cross-tab state with late-joiner handshake, last-write-wins conflict resolution and optional `persist`.
- Legacy `localStorage` fallback and SSR-safe no-op transport.
- TypeScript definitions, `node:test` suite and GitHub Actions CI.
- Interactive demo (theme, cart, session, live channel traffic) and a React hook example.
