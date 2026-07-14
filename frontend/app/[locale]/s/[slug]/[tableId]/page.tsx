'use client';

import { use, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { Crown, Loader2, Users, ArrowRight } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';

interface SeatingData {
  name: string;
  clientNames: string | null;
  eventDate: string | null;
  tables: { id: number; label: string; type: 'normal' | 'vip'; guests: string | null }[];
}

export default function SingleTablePage({
  params,
}: {
  params: Promise<{ slug: string; tableId: string }>;
}) {
  const { slug, tableId } = use(params);

  const { data, isLoading, error } = useQuery({
    queryKey: ['seating', slug],
    queryFn: () => api<SeatingData>(`/api/public/events/${slug}/tables`),
    refetchInterval: 60_000,
  });

  const table = useMemo(
    () => data?.tables.find((t) => String(t.id) === tableId) ?? null,
    [data, tableId]
  );

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-cream">
        <Loader2 className="h-7 w-7 animate-spin text-gold-dark" />
      </main>
    );
  }

  if (error || !data || !table) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-cream px-6 text-center">
        <p className="font-display text-2xl font-bold">Sto nije pronađen</p>
        <p className="text-sm text-ink/50">Provjerite QR kod ili link.</p>
        <Link href={`/s/${slug}`} className="mt-2 text-sm font-medium text-gold-dark hover:underline">
          Vidi cijeli raspored
        </Link>
      </main>
    );
  }

  const guestList = (table.guests ?? '')
    .split(',')
    .map((g) => g.trim())
    .filter(Boolean);

  const isVip = table.type === 'vip';

  return (
    <main className="flex min-h-screen flex-col items-center bg-cream px-5 pb-16 pt-14">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-sm text-center"
      >
        <p className="text-xs uppercase tracking-[0.3em] text-gold-dark">
          {data.clientNames || data.name}
        </p>

        {/* Broj stola */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.1 }}
          className={`mx-auto mt-5 flex h-28 w-28 items-center justify-center rounded-3xl font-display text-5xl font-bold shadow-lifted ${
            isVip ? 'bg-gold text-ink' : 'bg-ink text-cream'
          }`}
        >
          {table.label}
        </motion.div>

        <h1 className="mt-4 flex items-center justify-center gap-2 font-display text-2xl font-bold">
          Sto {table.label}
          {isVip && (
            <span className="flex items-center gap-1 rounded-full bg-gold/15 px-2 py-0.5 text-xs font-bold text-gold-dark">
              <Crown className="h-3 w-3" /> VIP
            </span>
          )}
        </h1>
        <p className="mt-1 text-sm text-ink/45">Za ovim stolom sjede:</p>

        {/* Gosti */}
        <div className="mt-5 space-y-2 text-left">
          {guestList.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-ink/15 py-10 text-center text-sm text-ink/40">
              Ovaj sto je još slobodan.
            </div>
          ) : (
            guestList.map((g, i) => (
              <motion.div
                key={`${g}-${i}`}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15 + Math.min(i * 0.05, 0.6) }}
                className="flex items-center gap-3 rounded-xl border border-ink/8 bg-white px-4 py-3 shadow-soft"
              >
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                    isVip ? 'bg-gold/15 text-gold-dark' : 'bg-ink/8 text-ink/60'
                  }`}
                >
                  {g[0]?.toUpperCase()}
                </span>
                <span className="text-sm font-medium">{g}</span>
              </motion.div>
            ))
          )}
        </div>

        {guestList.length > 0 && (
          <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-ink/40">
            <Users className="h-3.5 w-3.5" /> {guestList.length}{' '}
            {guestList.length === 1 ? 'gost' : 'gostiju'}
          </p>
        )}

        <Link
          href={`/s/${slug}`}
          className="mt-8 inline-flex items-center gap-1.5 text-sm font-medium text-gold-dark hover:underline"
        >
          Vidi cijeli raspored <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </motion.div>

      <p className="mt-12 text-center text-xs text-ink/30">
        Special Day<span className="text-gold">.</span>
      </p>
    </main>
  );
}
