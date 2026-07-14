'use client';

import { use, useRef, useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Star,
  ImagePlus,
  Loader2,
  Check,
  Trash2,
  MessageSquareWarning,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { imageUrl } from '@/lib/menuTypes';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

interface VenueSettings {
  id: number;
  name: string;
  googleReviewUrl: string | null;
  reviewGateEnabled: boolean;
  wheelEnabled: boolean;
  wheelPercentage: number | null;
  promoImagePath: string | null;
  promoCaption: string | null;
}

interface Feedback {
  id: number;
  rating: number;
  name: string | null;
  contact: string | null;
  message: string;
  createdAt: string;
}

export default function VenueSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const qc = useQueryClient();

  const { data: venue, isLoading } = useQuery({
    queryKey: ['venueSettings', id],
    queryFn: () => api<VenueSettings>(`/api/venues/${id}`),
  });

  const { data: feedback } = useQuery({
    queryKey: ['feedback', id],
    queryFn: () => api<Feedback[]>(`/api/venues/${id}/feedback`),
  });

  // form state
  const [reviewUrl, setReviewUrl] = useState('');
  const [reviewGate, setReviewGate] = useState(false);
  const [promoCaption, setPromoCaption] = useState('');
  const [promoPath, setPromoPath] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const promoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!venue) return;
    setReviewUrl(venue.googleReviewUrl ?? '');
    setReviewGate(venue.reviewGateEnabled);
    setPromoCaption(venue.promoCaption ?? '');
    setPromoPath(venue.promoImagePath ?? null);
  }, [venue]);

  const save = useMutation({
    mutationFn: () =>
      api(`/api/venues/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          googleReviewUrl: reviewUrl.trim(),
          reviewGateEnabled: reviewGate,
          promoCaption: promoCaption.trim(),
        }),
      }),
    onSuccess: () => {
      setSaved(true);
      setError(null);
      setTimeout(() => setSaved(false), 2000);
      qc.invalidateQueries({ queryKey: ['venueSettings', id] });
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Greška pri spremanju'),
  });

  const uploadPromo = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('image', file);
      const res = await fetch(`${API_URL}/api/venues/${id}/promo`, {
        method: 'POST',
        credentials: 'include',
        body: form,
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Upload nije uspio');
      setPromoPath((await res.json()).promoImagePath);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload nije uspio');
    } finally {
      setUploading(false);
    }
  };

  const removePromo = async () => {
    await api(`/api/venues/${id}/promo`, { method: 'DELETE' });
    setPromoPath(null);
  };

  if (isLoading || !venue) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-gold-dark" />
      </div>
    );
  }

  const input =
    'w-full rounded-lg border border-ink/12 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-gold';

  return (
    <div className="max-w-2xl space-y-6">
      {/* Recenzije */}
      <Section icon={Star} title="Google recenzije">
        <p className="mb-3 text-sm text-ink/50">
          Gost klikne "Ostavite recenziju" na meniju i ocijeni zvjezdicama.
        </p>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-ink/50">Google recenzija link</span>
          <input
            placeholder="https://g.page/r/..."
            value={reviewUrl}
            onChange={(e) => setReviewUrl(e.target.value)}
            className={input}
          />
        </label>
        <label className="mt-3 flex cursor-pointer items-start gap-2.5">
          <input
            type="checkbox"
            checked={reviewGate}
            onChange={(e) => setReviewGate(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-[#d4af37]"
          />
          <span className="text-sm">
            <strong>Filter recenzija</strong>
            <span className="block text-xs text-ink/45">
              Ocjena 4–5★ ide na Google; ocjena ispod 4★ ide u privatnu žalbu (ne javno) — vidiš je
              dolje.
            </span>
          </span>
        </label>
      </Section>

      {/* Promo slika */}
      <Section icon={ImagePlus} title="Promo baner">
        <p className="mb-3 text-sm text-ink/50">Slika na vrhu menija — akcija, novo u ponudi...</p>
        <button
          type="button"
          onClick={() => promoRef.current?.click()}
          disabled={uploading}
          className="relative flex h-40 w-full items-center justify-center overflow-hidden rounded-xl border border-dashed border-ink/20 text-ink/35 transition-colors hover:border-gold hover:text-gold-dark"
        >
          {promoPath ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl(promoPath)!} alt="" className="h-full w-full object-cover" />
          ) : uploading ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : (
            <span className="flex flex-col items-center gap-2 text-sm">
              <ImagePlus className="h-6 w-6" /> Dodaj promo sliku
            </span>
          )}
        </button>
        <input
          ref={promoRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && uploadPromo(e.target.files[0])}
        />
        {promoPath && (
          <button
            onClick={removePromo}
            className="mt-2 flex items-center gap-1.5 text-xs font-medium text-red-500 hover:underline"
          >
            <Trash2 className="h-3.5 w-3.5" /> Ukloni promo sliku
          </button>
        )}
        <input
          placeholder="Tekst preko slike (opcionalno)"
          value={promoCaption}
          onChange={(e) => setPromoCaption(e.target.value)}
          className={`${input} mt-3`}
        />
      </Section>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <button
        onClick={() => save.mutate()}
        disabled={save.isPending}
        className="btn-glossy flex items-center justify-center gap-2 rounded-full bg-gold px-6 py-3 text-sm font-semibold text-neutral-900 disabled:opacity-50"
      >
        {save.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : saved ? (
          <Check className="h-4 w-4" />
        ) : null}
        {saved ? 'Spremljeno' : 'Sačuvaj postavke'}
      </button>

      {/* Privatne žalbe */}
      <Section icon={MessageSquareWarning} title={`Privatne žalbe (${feedback?.length ?? 0})`}>
        {!feedback?.length ? (
          <p className="py-4 text-center text-sm text-ink/40">Nema žalbi — sve pohvale! 🎉</p>
        ) : (
          <div className="space-y-2">
            {feedback.map((f) => (
              <div key={f.id} className="rounded-xl border border-ink/8 p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((v) => (
                      <Star
                        key={v}
                        className="h-3.5 w-3.5"
                        style={{
                          color: v <= f.rating ? '#e0be5a' : 'rgba(0,0,0,0.15)',
                          fill: v <= f.rating ? '#e0be5a' : 'transparent',
                        }}
                      />
                    ))}
                  </div>
                  <span className="text-[11px] text-ink/35">
                    {new Date(f.createdAt).toLocaleDateString('bs-BA')}
                  </span>
                </div>
                <p className="mt-1.5 text-sm">{f.message}</p>
                {f.contact && <p className="mt-1 text-xs text-ink/45">Kontakt: {f.contact}</p>}
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-ink/8 bg-white p-5 shadow-soft">
      <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-bold">
        <Icon className="h-5 w-5 text-gold-dark" />
        {title}
      </h2>
      {children}
    </div>
  );
}
