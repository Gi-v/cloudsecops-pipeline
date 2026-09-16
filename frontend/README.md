# CloudSecOps Dashboard (Frontend)

React 18 + TypeScript + Vite dashboard for the CloudSecOps Pipeline backend.

## Quickstart

```bash
cd frontend
npm install
cp .env.example .env   # if you created one; otherwise defaults point at localhost:8000
npm run dev
```

Open http://localhost:5173. The dashboard expects the backend at
`http://localhost:8000` (override with `VITE_API_BASE_URL` / `VITE_WS_URL` env vars —
see `../.env.example`).

## Design

Dark/light glassmorphic theme (same token system as the `portfolio/` site — aurora blob
background, glass cards, Syne/Plus Jakarta Sans/JetBrains Mono type stack). Built with:

- **[Framer Motion](https://www.framer.com/motion/)** — animated route transitions, staggered
  card/row entrances, an animated active-tab indicator in the sidebar (`layoutId`), and
  count-up KPI numbers.
- **[Lucide](https://lucide.dev/)** — icon set used throughout (nav, severity badges, empty
  states, command palette).
- **[Sonner](https://sonner.emilkowal.ski/)** — toast notifications for scan results, status
  updates, and errors, themed to match dark/light mode.
- **Command palette** (`Cmd/Ctrl+K`) — jump to any page or run a scan / toggle theme without
  touching the mouse, in the style of Linear/Raycast/Vercel.
- **Skeleton loaders** for KPI cards, charts, and tables instead of a bare "Loading…" string.
- **One shared WebSocket** (`src/context/LiveFeedContext.tsx`) — every consumer (sidebar
  connection pill, dashboard live panel) reads from one context instead of each opening its
  own socket.

### Effects adapted from Aceternity UI / Magic UI

A handful of components port specific, well-known open-source effects — both libraries are
MIT-licensed component collections built on React + Framer Motion. The *techniques* are
reproduced (fetched from their real source and adapted onto this app's own CSS custom
properties instead of Tailwind, since this project doesn't use Tailwind); nothing is a
blind copy-paste of Tailwind classes that wouldn't run here.

- **`MagicCard.tsx`** — the mouse-tracking gradient border on every KPI/chart/panel card,
  adapted from [Magic UI's MagicCard](https://magicui.design/docs/components/magic-card).
  Two layered backgrounds (a solid padding-box fill + a radial-gradient border-box ring)
  driven by `useMotionValue`/`useMotionTemplate` so the cursor position updates a CSS
  custom property directly — never triggers a React re-render.
- **`BorderBeam.tsx`** — the dot that circles the Live Findings panel's border while
  connected, from [Magic UI's BorderBeam](https://magicui.design/docs/components/border-beam)
  — a small element animated along `offset-path: rect(...)` via `offsetDistance`. Wired as
  a literal status signal here, not decoration: it only renders while the WebSocket is live.
- **`Spotlight.tsx`** — the ambient blurred-ellipse glow behind the page header, from
  [Aceternity UI's Spotlight](https://ui.aceternity.com/components/spotlight) — same SVG
  `<ellipse>` + `feGaussianBlur` + scale/fade-in keyframes.
- **Shimmer border on `.btn`** (`index.css`) — the slow rotating highlight on primary
  buttons, the same conic-gradient-masked-to-a-ring idea as
  [Magic UI's ShimmerButton](https://magicui.design/docs/components/shimmer-button),
  reimplemented as a plain CSS `::before` + `mask-composite: exclude` instead of their
  extra DOM layer, since a mask trick alone gets the same result here.
- **`useAnimatedNumber.ts`** — KPI count-up, rewritten around `useMotionValue` +
  `useSpring` after the same pattern as
  [Magic UI's NumberTicker](https://magicui.design/docs/components/number-ticker), which
  also sidesteps a real bug the original hand-rolled `requestAnimationFrame` version had
  (see the file's comment and the earlier commit — two clocks, `performance.now()` and the
  rAF callback's own timestamp, aren't guaranteed to agree).

## Pages

| Route | Purpose |
|---|---|
| `/` | Dashboard — KPI row, severity/framework charts, CIS family compliance bars, live WebSocket findings feed |
| `/findings` | Filterable findings table with inline status updates |
| `/resources` | Every collected cloud resource, filterable by provider |
| `/policies` | Policy Simulator — paste/select a resource JSON, evaluate live against every Rego control |
| `/evidence` | Evidence chain viewer + hash-chain verification for a given resource URN |

## Scripts

```bash
npm run dev        # dev server with HMR
npm run build       # tsc typecheck + production build to dist/
npm run preview     # preview the production build locally
npx tsc -b --noEmit  # typecheck only
```

## Structure

```
src/
├── api/client.ts             Axios client + typed endpoint wrappers
├── types/index.ts             Shared TypeScript types mirroring the backend's Pydantic schemas
├── context/LiveFeedContext.tsx  Single shared WebSocket connection + reconnect logic + critical-alert tracking
├── hooks/
│   ├── useTheme.ts             Dark/light persisted theme, respects prefers-color-scheme
│   └── useAnimatedNumber.ts    Spring-physics count-up for KPI values (Magic UI NumberTicker pattern)
├── components/
│   ├── Sidebar.tsx               Nav with icons, animated active-link indicator, notification bell
│   ├── CommandPalette.tsx         Cmd+K command palette
│   ├── MagicCard.tsx              Mouse-tracking gradient-border card (wraps most panels)
│   ├── BorderBeam.tsx             Traveling border-light "live" indicator
│   ├── Spotlight.tsx              Ambient SVG background glow
│   ├── SearchInput.tsx            Debounced search box
│   ├── EmptyState.tsx / Skeleton.tsx   Empty & loading states used across every page
│   ├── SeverityBadge.tsx, KpiCard.tsx, AnimatedNumber.tsx
│   ├── charts.ts, SeverityDoughnut.tsx, FrameworkBarChart.tsx   Theme-aware chart.js wrappers
│   ├── ScanButton.tsx, LiveFeedPanel.tsx
│   └── *.test.tsx                 Vitest + Testing Library specs alongside their components
├── test/setup.ts               jest-dom matchers for vitest
├── pages/                       DashboardPage, FindingsPage, ResourcesPage, PolicySimulatorPage, EvidencePage
├── App.tsx                       Router + sidebar/aurora/spotlight shell + animated route transitions
└── main.tsx                      Entry point
```

## Tests

```bash
npm run test              # vitest run — 36 tests across components + hooks
npx vitest                 # watch mode
```
