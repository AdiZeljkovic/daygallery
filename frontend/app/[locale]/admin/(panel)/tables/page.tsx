'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { Armchair, Loader2, CalendarDays } from 'lucide-react';
import { api } from '@/lib/api';
import { SeatingManager } from '@/components/admin/SeatingManager';

interface EventRow {
  id: number;
  slug: string;
  name: string;
  eventDate: string | null;
  clientNames: string | null;
}

export default function TablesPage() {
  const { data: events, isLoading } = useQuery({
    queryKey: ['events'],
    queryFn: () => api<EventRow[]>('/api/events'),
  });

  const [eventId, setEventId] = useState<number | null>(null);
  const selected = useMemo(
    () => events?.find((e) => e.id === eventId) ?? null,
    [events, eventId]
  );

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold">Stolovi &amp; rezervacije</h1>
        <p className="mt-1 text-sm text-ink/50">
          Odaberi event pa generiši stolove i rasporedi goste. Gosti raspored vide preko QR koda.
        </p>
      </div>

      {/* Birač eventa */}
      <div className="mb-5 max-w-md">
        <label className="block">
          <span className="mb-1 flex items-center gap-1.5 text-xs font-medium text-ink/50">
            <CalendarDays className="h-3.5 w-3.5" /> Event
          </span>
          <select
            value={eventId ?? ''}
            onChange={(e) => setEventId(e.target.value ? Number(e.target.value) : null)}
            disabled={isLoading}
            className="w-full rounded-lg border border-ink/12 bg-white px-3 py-2.5 text-sm outline-none transition-colors focus:border-gold disabled:opacity-50"
          >
            <option value="">Odaberi event…</option>
            {events?.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
                {e.eventDate ? ` — ${new Date(e.eventDate).toLocaleDateString('bs-BA')}` : ''}
              </option>
            ))}
          </select>
        </label>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-gold-dark" />
        </div>
      ) : !selected ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="rounded-2xl border border-dashed border-ink/15 py-24 text-center"
        >
          <Armchair className="mx-auto mb-3 h-9 w-9 text-ink/20" />
          <p className="text-sm text-ink/45">
            Odaberite event iz padajućeg menija da vidite plan stolova i rezervacije.
          </p>
        </motion.div>
      ) : (
        <motion.div key={selected.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <SeatingManager eventId={selected.id} slug={selected.slug} eventName={selected.name} />
        </motion.div>
      )}
    </div>
  );
}
