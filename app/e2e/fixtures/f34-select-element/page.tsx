export default function F34SelectElementFixturePage() {
  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: 24 }}>
      <section
        id="first-card"
        data-e2e-target="first"
        style={{
          border: '1px solid #94a3b8',
          borderRadius: 8,
          marginBottom: 16,
          padding: 16,
        }}
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
        style={{
          border: '1px solid #38bdf8',
          borderRadius: 8,
          padding: 16,
        }}
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
