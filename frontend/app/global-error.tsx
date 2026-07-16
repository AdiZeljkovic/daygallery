'use client';

// Hvata greške u root layoutu (mora renderovati vlastiti <html>/<body>).
export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="bs">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1.25rem',
          background: '#fdfbf7',
          color: '#1c1b19',
          fontFamily: 'system-ui, sans-serif',
          textAlign: 'center',
          padding: '1.5rem',
        }}
      >
        <div style={{ fontSize: '2rem' }}>⚠️</div>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700 }}>Nešto je pošlo po zlu</h1>
          <p style={{ marginTop: '0.5rem', opacity: 0.55, fontSize: '0.9rem', maxWidth: 360 }}>
            {error?.message ?? 'Neočekivana greška.'} Pokušaj ponovo.
          </p>
        </div>
        <button
          onClick={reset}
          style={{
            border: 'none',
            borderRadius: 999,
            background: '#d4af37',
            color: '#111',
            padding: '0.75rem 1.5rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Pokušaj ponovo
        </button>
      </body>
    </html>
  );
}
