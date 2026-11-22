'use client';

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  return (
    <html lang="bn">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          background: '#0b0f14',
          color: '#e6edf3',
          fontFamily: 'ui-sans-serif, system-ui, sans-serif',
          padding: 24,
          textAlign: 'center',
        }}
      >
        <div>
          <h1 style={{ fontSize: 20, margin: 0 }}>সার্ভার এরর</h1>
          <p style={{ color: '#8b98a5', fontSize: 14, marginTop: 8 }}>
            {error?.message || 'অজানা সমস্যা'}
          </p>
        </div>
      </body>
    </html>
  );
}
