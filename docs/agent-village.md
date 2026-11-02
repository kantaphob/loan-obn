# Animated Agent Village: Coder pilot

The home page is an immersive room dashboard. Ten business departments are available in the left rail; their dialogs describe roles. Only the Coder pilot currently has a rig, live worker and server state. There is no LLM integration or automatic financial action.

## End-to-end flow

1. The browser connects to `/api/agent-village` (WebSocket) and receives an `agent.snapshot`.
2. The operator clicks **ตรวจโปรเจกต์**. `POST /api/agent-village/run` accepts only same-origin JSON requests and starts a fixed, single concurrent job.
3. The server reads `package.json` and eleven allowlisted project files, then invokes the local TypeScript binary with `--noEmit --incremental false`. No user-supplied commands or paths are accepted.
4. Actual tool execution emits `thinking`, `tool_calling`, `working`, `handoff`, then `success` or `error`. The handoff is to a deterministic report validator, not another LLM.
5. A report is saved in `private/agent-village/reports/<taskId>.json`. The result is included in the final snapshot and shown in the activity/report drawer.
6. Connection recovery restores the current server snapshot. Sequence numbers suppress duplicates and trigger resync on gaps. Animation pauses on disconnect; the UI labels stale data.

There are no random status cycles or artificial worker delays. Short-lived events may appear only in the event log when real work finishes faster than a physical animation. Local walk motion is the visual transition to the server-selected station; it does not invent worker states.

Jobs and event history (last 80 events) live in the server process. Page reloads do not stop jobs. A server restart resets this in-memory session; jobs are not durable across server restarts. JSON reports remain on disk. Type checking has a 90-second timeout.

## Rive source and mapping

- Source: `animations/coder/scene.rml`.
- Authoring generator: `animations/coder/generate-scene.mjs`.
- Runtime asset: `public/ai-sect/rive/coder.riv`.
- Artboard: `Coder`; machine: `CoderController`; view model: `CoderState`.
- Auto-bound numeric property: `pose`.

| pose | Animation |
|---|---|
| 0 | Idle / tea / blink |
| 1 | Thinking |
| 2 | Walk (during station travel) |
| 3 | Seated working |
| 4 | Tool calling |
| 5 | Handoff / scroll |
| 6 | Success / jump / sparks |
| 7 | Error / smoke |

The rig consists of separate head, eyes, trailing hair, torso, arms, legs and props. It is a simple vector pilot, not the detailed portrait atlas rigged automatically. Other department portraits are static selectors.

Both WASM variants are served locally. Reduced-motion preference and the motion checkbox pause the animation; worker state and events continue updating.

## Authoring

The Rive CLI was installed locally under the git-ignored `work/rive-cli/` cache. For a fresh checkout, install the official Rive CLI. The source uses no scripts; a local unsigned `--once` build works in the web runtime without account sign-in.

```sh
node animations/coder/generate-scene.mjs
rive animations/coder --verify
rive inspect animations/coder --summary
rive animations/coder --once
cp animations/coder/build/coder.riv public/ai-sect/rive/coder.riv
```

When changing the rig, also render representative poses with `--screenshot --data=pose=3 --advance=15`, etc.

## Development and checks

Use `npm run dev` or `node server.mjs`; running plain `next dev` omits the custom WebSocket hub. Existing `/api/realtime` notifications remain separate.

```sh
node --test tests/agent-village.test.mjs
npx eslint components/agent-village app/page.tsx app/api/agent-village/run/route.ts lib/agent-village tests/agent-village.test.mjs
npx tsc --noEmit
```

Browser validation covers a live job, report display, reconnection snapshot, team dialogs, dashboard activity drawer and responsive layout. Foreign-origin POST and WebSocket connections are rejected.
