# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

The hands-on project for the **Vercel Agent Foundations Certification** workshop. The user is working
through it chapter by chapter, and **Claude is here to help build it.** The repo has two layers:

1. **A finished storefront** — "Ship It Shop", backed by the live Vercel Swag Store API. No local
   product or cart database. This layer is reference material, not the thing being built. Don't
   refactor it unless asked.
2. **The workshop scaffold** — the agent, tools, workflows, and chat API routes. This is the actual
   work. Chapters land here one at a time.

## How to help

**The user pastes the exercise text from the workshop docs into the conversation. Write the code it
asks for.** Implement it directly — no tutorial, no walking them through it, no waiting for them to
type it themselves. Build exactly what the exercise specifies and stop there; don't add extra features
or polish it wasn't asking for.

Afterwards, say only what's needed: which files changed and anything that needs their attention (a
decision you had to make, an env var to set, something to click to check it). Skip the explanatory
commentary unless they ask for it.

- **Check file state before assuming.** Stubs get filled in as chapters complete, so read the file
  rather than trusting the status list below.
- **Use the Vercel skills** — `vercel:ai-sdk`, `vercel:workflow`, `vercel:build-agents`,
  `vercel:ai-gateway`. The AI SDK 7 agent APIs here (`ToolLoopAgent`, `createAgentUIStreamResponse`,
  `DurableAgent`) are recent and easy to get wrong from memory. Check the skill before writing.
- **Match the house style.** `lib/tools.ts` and `lib/agent.ts` are the worked examples the workshop
  provides: long, specific tool `description` strings; zod input schemas with `.describe()` on each
  field; `execute` catching `ApiRequestError` and returning `{ error }` instead of throwing. New tools
  and agents should look like those.
- **Never call the Swag Store API directly.** Everything goes through `lib/api.ts`, which owns the
  bypass secret and the caching rules.
- **Verify by running it.** There are no tests. Start `pnpm dev`, open the chat panel, and actually
  exercise the flow. `lib/api.ts` logs every request and failure to the server console, and
  `typescript.ignoreBuildErrors` is on — so a clean build proves nothing (see Gotchas).

### Chapter status

Implemented: `lib/tools.ts`, `lib/agent.ts`, `app/api/chat/route.ts`, `components/agent-chat.tsx`
(the customer chat panel works end to end).

Still to build:

| File | Chapter |
| --- | --- |
| `lib/workflows/chat-flow.ts` | Durable chat agent |
| `lib/workflows/return-flow.ts` | Returns workflow |
| `lib/workflows/admin-chat-flow.ts` | Admin agent workflow |
| `app/api/chat/[id]/stream/route.ts` | Stream resume (returns `501`) |
| `app/api/admin/chat/route.ts` | Admin chat endpoint (returns `501`) |
| `components/admin-agent-chat.tsx` | Admin chat UI — still placeholder `useState`, needs `useChat` |

The in-file comments point at `https://agent-foundations-certification.vercel.app/docs/<chapter>`, but
that host 404s — don't try to fetch it. The exercise text comes from the user instead.

## Commands

Package manager is **pnpm**, pinned via `packageManager` in `package.json` (run it through Corepack:
`corepack enable pnpm`). `pnpm-lock.yaml` is the only lockfile — don't use npm or yarn.
Dependencies allowed to run install scripts are listed under `allowBuilds` in `pnpm-workspace.yaml`;
add new ones with `pnpm approve-builds <pkg>`.

- `pnpm dev` — dev server on http://localhost:3000
- `pnpm build` — production build
- `pnpm start` — serve the production build
- `pnpm lint` — wired to `eslint .`, but ESLint is **not installed**; this fails until a linter is added

There is no test framework. Verification is `pnpm build` plus exercising the app.

## Stack

- **Next.js 16** App Router, **React 19**
- **AI SDK 7** (`ai@7`) for the agent; **`@ai-sdk/react@4`** for `useChat` (the version skew between
  the two packages is correct, not a mistake)
- **TypeScript** `strict: true`, `@/*` → project root
- **Tailwind CSS v4** (PostCSS); theme tokens are CSS variables in `app/globals.css`
- **shadcn/ui** (new-york, neutral base) in `components/ui/` — use `cn()` from `lib/utils.ts`
- **lucide-react** icons; **zod@3** for tool input schemas

## Environment

`.env` and `.env.local` are both gitignored (`.env*` is in `.gitignore`). There is **no `.env.example`**
despite the README referencing one.

- `BYPASS_SECRET` — **required**. Vercel deployment-protection bypass for the Swag Store API. Server-only;
  never give it a `NEXT_PUBLIC_` prefix.
- `API_BASE_URL` — optional, defaults to `https://vercel-agentic-swag-store-api.vercel.app/api`.
- `AI_GATEWAY_API_KEY` or `VERCEL_OIDC_TOKEN` — authenticates the AI Gateway model calls. The agent
  uses a bare gateway model string (`"anthropic/claude-sonnet-5"`), so one of these must be present or
  chat requests fail. `vercel env pull` refreshes the OIDC token (it expires).
- `STORE_BUSINESS_AGENT_URL` / `_BASIC_USER` / `_BASIC_PASSWORD` — only for the admin-agent chapter.
- `NEXT_PUBLIC_SITE_URL` — optional, used for `metadataBase`.

## Architecture

### Data layer (`lib/`)

- `lib/types.ts` — pure type module for every API schema (`Product`, `CartWithProducts`, `Order`,
  `Return`, `StockEntry`, `SupportTicket`, back-office meta types, …). Safe to import from client
  components. Also exports the `CATEGORY_SLUGS` const tuple and derived `CategorySlug`.
- `lib/api.ts` — the only module that talks to the Swag Store API. **Server-only by convention** (it
  reads `process.env.BYPASS_SECRET`). Two internal helpers: `request<T>` returns `data`;
  `requestWithMeta<T, M>` returns `{ data, meta }` and is used by back-office endpoints whose `meta`
  carries real information (date windows, totals, pagination). Throws `ApiRequestError`
  (`status`/`code`/`details`) on non-OK or `success: false`. 404s are intentionally not logged because
  callers swallow them (e.g. "no active promotion").
  - The bypass secret is sent **both** as the `x-vercel-protection-bypass` header *and* as a query
    param via `withBypass()` — some protection configs only honor the query form. Keep both.
  - Storefront reads: `getProducts`, `getProductById`, `getCategories`, `getPromotion`,
    `getStoreConfig`, `getProductStock`. Cart: `cartCreate/Get/Add/Update/Remove`.
    Returns flow: `getOrder`, `createReturn`, `preauthorizeRefund`, `notifyReturnInProcess`
    (the last is a `console.log` stand-in for an email provider).
    Back office: `getBackOfficeReturns`, `getBackOfficeSupportTickets`, `getBackOfficeStock`,
    `getBackOfficeSales` — all `cache: "no-store"`.
- `lib/format.ts` — `formatPrice(cents, currency)`. **API prices are integers in cents**; always route
  them through this rather than doing the math inline (tools return a `priceFormatted` field for the
  same reason, so the model never does cent arithmetic).
- `lib/cart-token.ts` — the API-issued cart UUID in an `httpOnly` `cart_token` cookie, 30-day max-age.
- `lib/cart-actions.ts` — `'use server'` cart mutations; each calls the API then `revalidateTag('cart')`.
  The first add lazily creates the cart server-side.

### Agent layer

- `lib/tools.ts` — AI SDK `tool()` definitions: `searchProducts` (broad, summary fields only),
  `getProductDetails` (one product: full record + **live** stock + related, via `Promise.allSettled` so a
  stock outage doesn't cost the description), `getAllCategories`, `returnOrder`. The long `description`
  strings are load-bearing — they are what steer the model between the broad and narrow product tools.
  Edit them deliberately. Every tool catches `ApiRequestError` and returns an `{ error }` object rather
  than throwing, so the model can recover in-loop.
- `lib/agent.ts` — a `ToolLoopAgent` with those tools and a system prompt that encodes the catalog's
  quirks (search matches single keywords not phrases; only `getProductDetails` has live stock; there is
  no size/variant data). Model is the gateway string `"anthropic/claude-sonnet-5"`.
- `app/api/chat/route.ts` — `createAgentUIStreamResponse({ agent, uiMessages })`.
- `lib/workflows/` — placeholders for the Workflow chapter (chat, admin-chat, return flows) plus the
  stream-resume route at `app/api/chat/[id]/stream/`.

### Caching strategy

Classic App Router. Cache Components / `'use cache'` are intentionally **not** used.

- Read endpoints pass `next: { revalidate: 300, tags: [...] }`. Tags: `products`, `product:{id}`,
  `categories`, `promotion` (60s), `store-config`.
- `getProductStock`, all cart endpoints, and all back-office endpoints use `cache: 'no-store'`.
- Cart mutations `revalidateTag('cart')` mainly for navigation re-renders; same-page UI relies on the
  action's return value plus `useOptimistic` in `components/cart-provider.tsx`.

### Routes

`app/layout.tsx` is a minimal root layout (html/body/fonts/metadata/`<Analytics>` in production only).
It is **synchronous and must stay that way** — see Gotchas.

`app/(store)/layout.tsx` is the storefront shell: `CartProvider` → `SidebarProvider` (right-side
`AgentSidebar` holding the chat panel, `--sidebar-width: 28rem`, closed by default) → `Header` / `main`
/ `Footer`, plus `CartSheet` and `AgentPanelSync`.

- `/` — `app/(store)/page.tsx`, `dynamic = "force-static"`, `revalidate = 60`. The default export is
  **synchronous** and renders three async siblings (`PromoBanner`, `FeaturedProducts`,
  `CategoryShowcase`) so their fetches fan out in parallel.
- `/search` — dynamic by necessity (reads `searchParams`). `Promise.all` for categories + products.
  `search-form.tsx` is client: `next/form` for the no-JS fallback, 300ms-debounced `router.replace`
  inside `startTransition` once `q.length >= 3`.
- `/products/[param]` — SSG. `param` accepts **id or slug** (the API resolves either);
  `generateStaticParams` enumerates via `getProducts({ limit: 100 })`. The only client island is
  `product-purchase.tsx`, which fetches stock on mount and polls every 30s — hence the brief
  "Checking availability…" state, which is the price of keeping the page statically renderable.
- `/admin` + `/admin/login` — gated by `proxy.ts`.

### Admin

`proxy.ts` is the Next 16 middleware file (renamed from `middleware.ts`); it exports `proxy()` and a
`matcher: ["/admin/:path*"]`, and redirects to `/admin/login` unless the cookie matches.
`lib/admin-auth.ts` holds the shared cookie name and password; `lib/admin-actions.ts` has the
login/logout server actions. This gate is **demo-grade on purpose** — hardcoded password, cookie value
*is* the password. Don't model real auth on it, and don't "fix" it without being asked.

### Client / server split

Client components exist only where state, effects, or browser APIs are required: the cart trio
(`cart-provider`, `cart-button`, `cart-sheet`), the agent chat UI (`agent-chat`, `agent-sidebar`,
`agent-panel-sync`, `agent-button`, `admin-agent-chat`, `components/ai-elements/*`),
`product-purchase.tsx`, and `search-form.tsx`. Everything else — `Header`, `Footer`, `ProductCard`,
`ProductGrid`, `PromoBanner`, `CategoryShowcase`, `RelatedProducts`, and every page — is a Server
Component.

## Gotchas

- **Keep the root layout synchronous.** If you make `app/layout.tsx` (or `app/(store)/layout.tsx`)
  `async` and await anything touching `cookies()`/`headers()`/`searchParams`, every route silently
  becomes dynamic. After any layout change, check `pnpm build` still reports `/` as `○`,
  `/products/[param]` as `●`, and `/search` as `ƒ`.
- **`AgentPanelSync` deliberately avoids `useSearchParams()`.** That hook forces a CSR bailout and
  deopts static rendering for the whole `(store)` group. It reads `window.location` on demand and uses
  `history.replaceState` to mirror panel state into `?chat=open`. Don't "simplify" it to the hook.
- `next.config.mjs` sets `typescript.ignoreBuildErrors: true` — **a green `pnpm build` does not mean the
  types are clean.** Run `pnpm exec tsc --noEmit` when type correctness matters.
- `serverExternalPackages: ["@vercel/oidc"]` must stay; `images.remotePatterns` is whitelisted for
  `**.public.blob.vercel-storage.com` and `**.vercel-storage.com`, where API product images live. Add
  hostnames there if the API serves images from a new domain.
- Vendored agent skills live in `.agents/skills/` and are pinned by `skills-lock.json`
  (`next-best-practices`, `vercel-react-best-practices`, `web-design-guidelines`). Consult them for
  Next.js/React conventions; don't hand-edit them — they're upstream copies with content hashes.
- The project is linked to Vercel (`vercel-agent-certification`) and to v0, which may push commits to
  `main` directly.
