export default function F34SelectElementFixturePage() {
  return (
    <main className="p-6 font-sans">
      <section
        id="first-card"
        data-e2e-target="first"
        className="mb-4 rounded-lg border border-slate-400 p-4"
      >
        <h1>F34 Select Element Fixture</h1>
        <p>This card is the first native select target.</p>
        <button id="first-target" type="button">
          First selectable target
        </button>
      </section>

      <section
        id="second-card"
        data-e2e-target="second"
        className="rounded-lg border border-sky-400 p-4"
      >
        <h2>Second target</h2>
        <p>Repeated selection should not reuse stale native callback state.</p>
        <button id="second-target" type="button">
          Second selectable target
        </button>
      </section>
    </main>
  );
}
