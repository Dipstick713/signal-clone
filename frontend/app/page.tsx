/**
 * Phase 1 app shell.
 *
 * The Signal desktop layout is a two-pane view: a fixed-width conversation
 * list rail on the left and a chat pane on the right. For now both panes show
 * empty-state placeholders; real data and interactivity arrive in later phases.
 */
export default function Home() {
  return (
    <div className="flex h-full">
      {/* Left rail: conversation list */}
      <aside className="flex w-80 shrink-0 flex-col border-r border-border bg-panel">
        <header className="flex items-center justify-between px-4 py-3">
          <h1 className="text-lg font-semibold">Signal</h1>
          <span className="text-xs text-secondary">Phase 1</span>
        </header>
        <div className="px-4 pb-3">
          <div className="rounded-full bg-hover px-4 py-2 text-sm text-secondary">
            Search
          </div>
        </div>
        <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-secondary">
          No conversations yet.
        </div>
      </aside>

      {/* Right pane: chat / empty state */}
      <main className="flex flex-1 flex-col items-center justify-center bg-app">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-signal text-2xl text-on-accent">
            💬
          </div>
          <h2 className="text-xl font-semibold">Signal Clone</h2>
          <p className="max-w-xs text-sm text-secondary">
            Select a conversation to start messaging. End-to-end encryption is
            simulated for this demo.
          </p>
        </div>
      </main>
    </div>
  );
}
