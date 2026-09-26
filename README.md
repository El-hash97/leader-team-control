# Leader Team Control

Web app for team leaders to monitor member skills per process (Toyota 1/4–4/4 skill map), plan skill upgrades for QCC activities, and control daily attendance.

> **UI preview.** All data is generated sample data held in memory (`src/lib/mock.ts`). Refreshing the page resets it. No backend is connected yet.

## Features

- **Dashboard**: daily KPIs, process backup for absent experts, contract/certificate alerts, QCC multi-skill trend, attendance ranking.
- **Data Member**: members with NoReg, position, class (3A–6C, Vokasi has none), contract end calculated from contract rules.
- **Skill Map**: member × process grid, evaluation history, target gaps, processes without backup.
- **Mapping Peningkatan**: upgrade plans with status flow; marking a plan achieved raises the skill map level.
- **Training**: certificate expiry (SIO) and member × training matrix.
- **Absensi**: daily input, mobile-first, bulk fill for unfilled members only.
- **Laporan**: monthly performance (CSV export), skill report, QCC before/after.
- **Pengaturan**: group parameters, contract length rules, process rename/order, holidays, baseline snapshot.

## Stack

Next.js (App Router) · TypeScript · Tailwind CSS · lucide-react

## Run

```bash
pnpm install
pnpm dev
```

Open http://localhost:3000 and sign in with any value (preview mode).

```bash
pnpm test        # business rules (node --test)
pnpm typecheck
pnpm lint
```

Business rules (working days, performance, contract length, multi-skill, backup) live in `src/lib/rules.ts` as pure functions with tests in `src/lib/rules.test.ts`.
