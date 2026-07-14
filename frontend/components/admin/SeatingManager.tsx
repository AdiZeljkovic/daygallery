'use client';

import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Trash2, Crown, Loader2, QrCode, Search, Armchair, Check } from 'lucide-react';
import { api } from '@/lib/api';
import { QrModal } from '@/components/admin/QrModal';

interface TableRow {
  id: number;
  label: string;
  type: 'normal' | 'vip';
  guests: string | null;
}

/** Upravljanje stolovima/rasporedom za jedan event — koristi se i u Event tabu i na globalnoj Stolovi stranici. */
export function SeatingManager({
  eventId,
  slug,
  eventName,
}: {
  eventId: number;
  slug: string;
  eventName: string;
}) {
  const qc = useQueryClient();
  const [qrOpen, setQrOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [bulkCount, setBulkCount] = useState('10');
  const [bulkType, setBulkType] = useState<'normal' | 'vip'>('normal');
  const [bulkStart, setBulkStart] = useState('1');

  const { data: tables, isLoading } = useQuery({
    queryKey: ['tables', eventId],
    queryFn: () => api<TableRow[]>(`/api/events/${eventId}/tables`),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['tables', eventId] });

  const bulkAdd = useMutation({
    mutationFn: () =>
      api(`/api/events/${eventId}/tables/bulk`, {
        method: 'POST',
        body: JSON.stringify({
          count: parseInt(bulkCount) || 1,
          type: bulkType,
          startNumber: parseInt(bulkStart) || 1,
        }),
      }),
    onSuccess: () => {
      invalidate();
      const next = (parseInt(bulkStart) || 1) + (parseInt(bulkCount) || 1);
      setBulkStart(String(next));
    },
  });

  const deleteTable = useMutation({
    mutationFn: (tableId: number) => api(`/api/tables/${tableId}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  });

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const q = search.toLowerCase();
  const filtered =
    tables?.filter(
      (t) => t.label.toLowerCase().includes(q) || (t.guests ?? '').toLowerCase().includes(q)
    ) ?? [];

  return (
    <div>
      {/* Bulk dodavanje + QR */}
      <div className="mb-5 flex flex-wrap items-end gap-3 rounded-xl border border-ink/8 bg-white p-4 shadow-soft">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-ink/50">Broj stolova</span>
          <input
            inputMode="numeric"
            value={bulkCount}
            onChange={(e) => setBulkCount(e.target.value.replace(/\D/g, ''))}
            className="w-24 rounded-lg border border-ink/12 px-3 py-2 text-sm outline-none focus:border-gold"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-ink/50">Počinje od</span>
          <input
            inputMode="numeric"
            value={bulkStart}
            onChange={(e) => setBulkStart(e.target.value.replace(/\D/g, ''))}
            className="w-24 rounded-lg border border-ink/12 px-3 py-2 text-sm outline-none focus:border-gold"
          />
        </label>
        <div>
          <span className="mb-1 block text-xs font-medium text-ink/50">Tip</span>
          <div className="flex gap-1.5">
            {(['normal', 'vip'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setBulkType(t)}
                className={`rounded-lg border px-3.5 py-2 text-xs font-medium transition-colors ${
                  bulkType === t
                    ? 'border-gold bg-gold/10 text-gold-dark'
                    : 'border-ink/10 text-ink/50 hover:border-ink/25'
                }`}
              >
                {t === 'vip' ? 'VIP' : 'Obični'}
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={() => bulkAdd.mutate()}
          disabled={bulkAdd.isPending || !parseInt(bulkCount)}
          className="btn-glossy flex items-center gap-2 rounded-full bg-gold px-4 py-2 text-sm font-semibold text-neutral-900 transition-colors disabled:opacity-50"
        >
          {bulkAdd.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Generiši stolove
        </button>
        <button
          onClick={() => setQrOpen(true)}
          className="ml-auto flex items-center gap-2 rounded-lg bg-ink px-4 py-2 text-sm font-medium text-cream transition-colors hover:bg-ink-soft"
        >
          <QrCode className="h-4 w-4" />
          QR raspored
        </button>
      </div>

      {/* Pretraga */}
      <div className="relative mb-4 max-w-xs">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/30" />
        <input
          placeholder="Pretraži sto ili gosta..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-ink/12 py-2 pl-9 pr-3 text-sm outline-none focus:border-gold"
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-gold-dark" />
        </div>
      ) : !tables?.length ? (
        <div className="rounded-xl border border-dashed border-ink/15 py-20 text-center">
          <Armchair className="mx-auto mb-3 h-8 w-8 text-ink/20" />
          <p className="text-ink/40">Nema stolova — generišite ih iznad.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence initial={false}>
            {filtered.map((table) => (
              <TableCard
                key={table.id}
                table={table}
                onDelete={() => {
                  if (confirm(`Obrisati sto ${table.label}?`)) deleteTable.mutate(table.id);
                }}
                onSaved={invalidate}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      <QrModal
        open={qrOpen}
        onClose={() => setQrOpen(false)}
        title={`${eventName} — Raspored sjedenja`}
        url={`${origin}/s/${slug}`}
      />
    </div>
  );
}

function TableCard({
  table,
  onDelete,
  onSaved,
}: {
  table: TableRow;
  onDelete: () => void;
  onSaved: () => void;
}) {
  const [guests, setGuests] = useState(table.guests ?? '');
  const [saved, setSaved] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // debounce 700ms — auto-save gostiju
  useEffect(() => {
    if (guests === (table.guests ?? '')) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      await api(`/api/tables/${table.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ guests: guests || null }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
      onSaved();
    }, 700);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guests]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.94 }}
      className="rounded-xl border border-ink/8 bg-white p-4 shadow-soft"
    >
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className={`flex h-9 w-9 items-center justify-center rounded-lg font-display font-bold ${
              table.type === 'vip' ? 'bg-gold text-neutral-900' : 'bg-ink text-cream'
            }`}
          >
            {table.label}
          </span>
          {table.type === 'vip' && (
            <span className="flex items-center gap-1 rounded-full bg-gold/12 px-2 py-0.5 text-[10px] font-bold text-gold-dark">
              <Crown className="h-2.5 w-2.5" /> VIP
            </span>
          )}
          <AnimatePresence>
            {saved && (
              <motion.span
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-1 text-[11px] font-medium text-emerald-600"
              >
                <Check className="h-3 w-3" /> Sačuvano
              </motion.span>
            )}
          </AnimatePresence>
        </div>
        <button
          onClick={onDelete}
          className="rounded-lg p-1.5 text-ink/30 transition-colors hover:bg-red-50 hover:text-red-500"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      <textarea
        placeholder="Gosti za ovim stolom (odvojite zarezom)..."
        value={guests}
        onChange={(e) => setGuests(e.target.value)}
        rows={2}
        className="w-full resize-none rounded-lg border border-ink/10 px-3 py-2 text-sm outline-none transition-colors focus:border-gold"
      />
    </motion.div>
  );
}
