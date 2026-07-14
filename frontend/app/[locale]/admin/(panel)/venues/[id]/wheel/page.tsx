'use client';

import { use, useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { Gift, Loader2, Check, Star, Info, ArrowRight } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { api, ApiError } from '@/lib/api';
import { imageUrl, fmtPrice, finalPrice } from '@/lib/menuTypes';
import type { AdminMenuTree, MenuItemRow } from '@/lib/menuTypes';

interface VenueWheel {
  id: number;
  wheelEnabled: boolean;
  wheelPercentage: number | null;
  currency: string;
}

export default function VenueWheelPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const qc = useQueryClient();

  const { data: venue, isLoading } = useQuery({
    queryKey: ['venueWheel', id],
    queryFn: () => api<VenueWheel>(`/api/venues/${id}`),
  });

  const { data: menu } = useQuery({
    queryKey: ['menu', id],
    queryFn: () => api<AdminMenuTree>(`/api/venues/${id}/menu`),
  });

  const prizes: MenuItemRow[] =
    menu?.categories.flatMap((c) => c.items.filter((i) => i.isFeatured)) ?? [];

  const [enabled, setEnabled] = useState(false);
  const [pct, setPct] = useState('');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!venue) return;
    setEnabled(venue.wheelEnabled);
    setPct(venue.wheelPercentage?.toString() ?? '');
  }, [venue]);

  const save = useMutation({
    mutationFn: () =>
      api(`/api/venues/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          wheelEnabled: enabled,
          wheelPercentage: pct ? parseInt(pct) : null,
        }),
      }),
    onSuccess: () => {
      setSaved(true);
      setError(null);
      setTimeout(() => setSaved(false), 2000);
      qc.invalidateQueries({ queryKey: ['venueWheel', id] });
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Greška pri spremanju'),
  });

  if (isLoading || !venue) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-gold-dark" />
      </div>
    );
  }

  const noPrizes = prizes.length === 0;
  const pctNum = pct ? parseInt(pct) : 0;
  const willShow = enabled && pctNum > 0 && !noPrizes;

  return (
    <div className="max-w-2xl space-y-6">
      {/* Konfiguracija */}
      <div className="rounded-2xl border border-ink/8 bg-white p-5 shadow-soft">
        <h2 className="mb-1 flex items-center gap-2 font-display text-lg font-bold">
          <Gift className="h-5 w-5 text-gold-dark" />
          Kolo sreće
        </h2>
        <p className="mb-4 text-sm text-ink/50">
          Gost pri ulasku na meni zavrti kolo i osvoji popust na nasumičan istaknut artikal.
        </p>

        <label className="flex cursor-pointer items-center gap-2.5">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="h-4 w-4 accent-[#d4af37]"
          />
          <span className="text-sm font-medium">Uključi kolo sreće na meniju</span>
        </label>

        {enabled && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mt-4 overflow-hidden"
          >
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-ink/50">Popust (%)</span>
              <input
                inputMode="numeric"
                placeholder="npr. 18"
                value={pct}
                onChange={(e) => setPct(e.target.value.replace(/\D/g, '').slice(0, 2))}
                className="w-28 rounded-lg border border-ink/12 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-gold"
              />
            </label>
          </motion.div>
        )}

        {error && <p className="mt-3 text-sm text-red-500">{error}</p>}

        <button
          onClick={() => save.mutate()}
          disabled={save.isPending}
          className="btn-glossy mt-5 flex items-center justify-center gap-2 rounded-full bg-gold px-6 py-3 text-sm font-semibold text-neutral-900 disabled:opacity-50"
        >
          {save.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : saved ? (
            <Check className="h-4 w-4" />
          ) : null}
          {saved ? 'Spremljeno' : 'Sačuvaj'}
        </button>

        {/* Status */}
        <div
          className={`mt-4 flex items-start gap-2 rounded-lg px-3 py-2.5 text-xs ${
            willShow ? 'bg-emerald-500/10 text-emerald-700' : 'bg-gold/8 text-ink/60'
          }`}
        >
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <p>
            {noPrizes
              ? 'Kolo se neće prikazati — nema istaknutih artikala. Označi bar jedan artikal zvjezdicom u tabu Meni.'
              : !enabled
                ? 'Kolo je isključeno.'
                : pctNum <= 0
                  ? 'Upiši postotak popusta veći od 0.'
                  : `Kolo je aktivno — gosti osvajaju -${pctNum}% na jedan od ${prizes.length} istaknutih artikala.`}
          </p>
        </div>
      </div>

      {/* Nagrade */}
      <div className="rounded-2xl border border-ink/8 bg-white p-5 shadow-soft">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold">
            <Star className="h-5 w-5 text-gold-dark" />
            Nagrade ({prizes.length})
          </h2>
          <Link
            href={`/admin/venues/${id}/menu`}
            className="flex items-center gap-1 text-xs font-medium text-gold-dark hover:underline"
          >
            Uredi u Meniju <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <p className="mb-3 text-sm text-ink/50">
          Nagrade su <strong>istaknuti artikli</strong> (zvjezdica na artiklu u tabu Meni). Kolo
          nasumično dodjeljuje popust na jedan od njih.
        </p>

        {noPrizes ? (
          <div className="rounded-xl border border-dashed border-ink/15 py-8 text-center text-sm text-ink/40">
            Nema istaknutih artikala. Idi u <strong>Meni</strong> i klikni zvjezdicu na artiklima
            koje želiš kao nagrade.
          </div>
        ) : (
          <div className="space-y-2">
            {prizes.map((p) => {
              const priceNum = parseFloat(p.price);
              return (
                <div
                  key={p.id}
                  className="flex items-center gap-3 rounded-xl border border-ink/8 p-2.5"
                >
                  {p.imagePath ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={imageUrl(p.imagePath)!}
                      alt=""
                      className="h-12 w-12 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-ink/5">
                      <Star className="h-4 w-4 text-ink/25" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{p.name}</p>
                    {pctNum > 0 ? (
                      <div className="flex items-center gap-1.5 text-xs">
                        <span className="text-ink/40 line-through">
                          {fmtPrice(priceNum, venue.currency)}
                        </span>
                        <span className="font-semibold text-gold-dark">
                          {fmtPrice(finalPrice(p.price, pctNum), venue.currency)}
                        </span>
                      </div>
                    ) : (
                      <p className="text-xs text-ink/40">{fmtPrice(priceNum, venue.currency)}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
