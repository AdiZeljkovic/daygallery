'use client';

import { use, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { Search, Crown, Armchair, Loader2, Users } from 'lucide-react';
import { api } from '@/lib/api';

interface SeatingData {
  name: string;
  clientNames: string | null;
  eventDate: string | null;
  tables: { id: number; label: string; type: 'normal' | 'vip'; guests: string | null }[];
}

/** Dijakritički-neosjetljiva pretraga */
const normalize = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');

export default function SeatingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [search, setSearch] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['seating', slug],
    queryFn: () => api<SeatingData>(`/api/public/events/${slug}/tables`),
    refetchInterval: 60_000,
  });

  const filtered = useMemo(() => {
    if (!data) return [];
    if (!search.trim()) return data.tables;
    const q = normalize(search);
    return data.tables.filter(
      (t) => normalize(t.label).includes(q) || normalize(t.guests ?? '').includes(q)
    );
  }, [data, search]);

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-cream">
        <Loader2 className="h-7 w-7 animate-spin text-gold-dark" />
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-cream px-6 text-center">
        <p className="font-display text-2xl font-bold">Raspored nije pronađen</p>
        <p className="text-sm text-ink/50">Provjerite link ili QR kod.</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-cream pb-16">
      {/* Header */}
      <header className="px-6 pb-6 pt-12 text-center">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <p className="text-xs uppercase tracking-[0.3em] text-gold-dark">Raspored sjedenja</p>
          <h1 className="mt-2 font-display text-3xl font-bold">
            {data.clientNames || data.name}
          </h1>
          {data.eventDate && (
            <p className="mt-1 text-sm text-ink/45">
              {new Date(data.eventDate).toLocaleDateString('bs-BA', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </p>
          )}
        </motion.div>
      </header>

      {/* Pretraga */}
      <div className="sticky top-0 z-30 border-b border-ink/6 bg-cream/90 px-5 py-3 backdrop-blur-lg">
        <div className="relative mx-auto max-w-md">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/30" />
          <input
            placeholder="Upišite svoje ime da pronađete sto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-full border border-ink/12 bg-white py-3 pl-10 pr-4 text-sm shadow-soft outline-none transition-colors focus:border-gold"
          />
        </div>
      </div>

      {/* Legenda */}
      <div className="mx-auto mt-5 flex max-w-md items-center justify-center gap-5 text-xs text-ink/45">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-ink" /> Obični sto
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-gold" /> VIP sto
        </span>
      </div>

      {/* Stolovi */}
      <div className="mx-auto mt-6 grid max-w-2xl gap-3 px-5 sm:grid-cols-2">
        {filtered.length === 0 ? (
          <div className="col-span-full py-16 text-center">
            <Armchair className="mx-auto mb-3 h-8 w-8 text-ink/15" />
            <p className="text-ink/40">
              {search ? `Nema rezultata za "${search}".` : 'Raspored još nije objavljen.'}
            </p>
          </div>
        ) : (
          filtered.map((table, i) => (
            <motion.div
              key={table.id}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.04, 0.5), duration: 0.35 }}
              className={`rounded-2xl border bg-white p-4 shadow-soft ${
                table.type === 'vip' ? 'border-gold/40' : 'border-ink/8'
              }`}
            >
              <div className="flex items-center gap-3">
                <span
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl font-display text-lg font-bold ${
                    table.type === 'vip' ? 'bg-gold text-ink' : 'bg-ink text-cream'
                  }`}
                >
                  {table.label}
                </span>
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-sm font-semibold">
                    Sto {table.label}
                    {table.type === 'vip' && (
                      <span className="flex items-center gap-0.5 rounded-full bg-gold/12 px-1.5 py-0.5 text-[10px] font-bold text-gold-dark">
                        <Crown className="h-2.5 w-2.5" /> VIP
                      </span>
                    )}
                  </p>
                  {table.guests ? (
                    <p className="mt-0.5 flex items-start gap-1 text-xs leading-relaxed text-ink/50">
                      <Users className="mt-0.5 h-3 w-3 shrink-0" />
                      <span>{table.guests}</span>
                    </p>
                  ) : (
                    <p className="mt-0.5 text-xs text-ink/30">Slobodno</p>
                  )}
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>

      <p className="mt-12 text-center text-xs text-ink/30">
        Special Day<span className="text-gold">.</span> — nezaboravni eventi
      </p>
    </main>
  );
}
