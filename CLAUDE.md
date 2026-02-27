# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

All commands use Bun as the package manager. Always use `bun --bun` prefix to ensure Bun's own runtime is used.

```bash
bun --bun run dev        # Start dev server on port 3000
bun --bun run build      # Production build
bun --bun run preview    # Preview production build
bun --bun run test       # Run Vitest tests
bun --bun run lint       # Run ESLint
bun --bun run format     # Check Prettier formatting
bun --bun run check      # Format with Prettier + fix ESLint
```

### Convex Backend
```bash
bunx --bun convex dev    # Start Convex dev server (run alongside bun dev)
bunx --bun convex init   # Initialize Convex (sets CONVEX_DEPLOYMENT and VITE_CONVEX_URL)
```

### Adding Shadcn Components
```bash
pnpm dlx shadcn@latest add [component-name]
```

## Architecture

**Flytie** is a full-stack SSR web application built on TanStack Start (React + Vite + Nitro).

### Routing
File-based routing via TanStack Router — add files to `src/routes/` and types are auto-generated. The root layout lives in `src/routes/__root.tsx` (provider hierarchy, theme init, Header/Footer). Use `Route.useLoaderData()` for type-safe data access and `createServerFn` for server-side code called from the client.

### Data Flow
- **Route loaders** fetch server-side data before render
- **TanStack Query** (`@tanstack/react-query`) manages client-side caching
- **Convex** is the backend database; functions live in `convex/` and are called via `@convex-dev/react-query`

### Content
Blog posts are Markdown/MDX files in `content/blog/`. They're processed by `@content-collections/*` using `content-collections.ts` config — transforming `.md` to HTML and `.mdx` to compiled components. Custom MDX components (`MdxCallout`, `MdxMetrics`) are in `src/components/`.

### Styling
Tailwind CSS v4 with custom design tokens defined as CSS variables in `src/styles.css` (theme: sea-ink, lagoon, palm, sand, etc.). Shadcn/ui is configured with `new-york` style, zinc base color, and lucide icons. The `cn()` utility is in `src/lib/utils.ts`. Theme (light/dark/auto) is stored in localStorage and initialized via inline script in `__root.tsx`.

### Path Aliases
Both `#/*` and `@/*` resolve to `./src/*`.

## Convex Schema Design

Do not add `_id` or `_creationTime` fields — they are automatically generated. Use `v` from `convex/values` for validators. Add `.index()` for query-optimized fields:

```ts
import { defineSchema, defineTable } from "convex/server"
import { v } from "convex/values"

export default defineSchema({
  items: defineTable({
    userId: v.id("users"),
    text: v.string(),
    status: v.union(v.literal("active"), v.literal("done")),
    meta: v.optional(v.string()),
  }).index("userId", ["userId"]),
})
```

## Code Style

- No semicolons, single quotes, trailing commas (enforced by Prettier)
- Strict TypeScript — no unused locals, parameters, or switch fallthrough
- React Compiler (Babel plugin) is active — avoid manual `useMemo`/`useCallback` where the compiler can infer it
