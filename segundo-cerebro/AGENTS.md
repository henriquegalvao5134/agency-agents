<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

- Brain regions, note-group→region mapping and skill→region paths live in src/components/dash/brain.ts; panels read from it so the map stays documented in one place.
- AI calls for brain agents go through createServerFn in src/lib/brain-ai.functions.ts using the built-in AI gateway; the allowed model list there is the single source for the UI picker.
- Brain delegation uses one validated native tool call followed by one executor call; task-scoped lifecycle events drive visual activity so concurrent tasks cannot clear each other's status.
- Graph layout uses independent world-space offsets for AI ports and the brain; camera pan and rotation remain separate so rearranging cards never changes neural geometry or task state.
- Jarvis uses a persistent same-origin Live relay and the shared brain index for read-only reasoning; preserve heartbeat, transcript revisions, cancellation and final usage draining, and never imply unconnected business data is available.
- News uses fixed public RSS sources and the official daily exchange-rate source through a read-only server function; expose source failures and reference dates rather than inventing headlines or real-time prices.
- Canvas connections are created on destination pointer-down, before drag capture; export notes and directed edges as JSON Canvas, without implying vault synchronization or agent execution.
- Campaign panels must show unavailable values until a real account integration is verified; catalog and plugin-lab examples must be labelled as demonstrations, never installations.
- The agent registry uses an external store with a stable server snapshot so adding agents and restoring browser storage share the same state without hydration races.
- Router dehydrate/hydrate hooks transfer completed public query snapshots to the browser; loaders await initial public reads and the existing root QueryClientProvider remains the single provider.
- Use root MANUAL.md as the shared documentation source for the repository and /manual page via a raw Markdown import, with README as its entry point; this prevents divergent copies. Its implementation examples describe the current state, not mandatory architecture: assess applicability and feasibility before changing code, while preserving security and truthful capability reporting.
