'use client';

import { useEffect } from 'react';

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-cream px-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gold/12 text-3xl">⚠️</div>
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">Nešto je pošlo po zlu</h1>
        <p className="mt-2 max-w-sm text-sm text-ink/50">
          Dogodila se greška pri učitavanju. Pokušaj ponovo — ako se nastavi, osvježi stranicu.
        </p>
      </div>
      <button
        onClick={reset}
        className="btn-glossy rounded-full bg-gold px-6 py-3 text-sm font-semibold text-neutral-900"
      >
        Pokušaj ponovo
      </button>
    </div>
  );
}
