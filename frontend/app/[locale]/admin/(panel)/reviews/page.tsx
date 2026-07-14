'use client';

import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'motion/react';
import {
  Star,
  Plus,
  Link2,
  QrCode,
  Pencil,
  Trash2,
  Loader2,
  Check,
  ImagePlus,
  ShieldCheck,
  MessageSquareWarning,
  X,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { imageUrl } from '@/lib/menuTypes';
import { QrModal } from '@/components/admin/QrModal';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

interface Campaign {
  id: number;
  slug: string;
  name: string;
  googleReviewUrl: string | null;
  logoPath: string | null;
  gateEnabled: boolean;
  _count?: { feedback: number };
}

interface Feedback {
  id: number;
  rating: number;
  name: string | null;
  contact: string | null;
  message: string;
  createdAt: string;
}

export default function ReviewsPage() {
  const qc = useQueryClient();
  const { data: campaigns, isLoading } = useQuery({
    queryKey: ['reviewCampaigns'],
    queryFn: () => api<Campaign[]>('/api/reviews'),
  });

  const [editing, setEditing] = useState<Campaign | 'new' | null>(null);
  const [qrFor, setQrFor] = useState<Campaign | null>(null);
  const [feedbackFor, setFeedbackFor] = useState<Campaign | null>(null);
  const [copied, setCopied] = useState<number | null>(null);

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const publicUrl = (slug: string) => `${origin}/r/${slug}`;

  const copyLink = async (c: Campaign) => {
    await navigator.clipboard.writeText(publicUrl(c.slug));
    setCopied(c.id);
    setTimeout(() => setCopied(null), 1500);
  };

  const del = useMutation({
    mutationFn: (id: number) => api(`/api/reviews/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reviewCampaigns'] }),
  });

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Recenzije</h1>
          <p className="mt-1 text-sm text-ink/50">
            Pametni Google review linkovi — gost ocijeni, a samo zadovoljni idu na Google.
          </p>
        </div>
        <button
          onClick={() => setEditing('new')}
          className="btn-glossy flex items-center gap-2 rounded-full bg-gold px-5 py-2.5 text-sm font-semibold text-neutral-900"
        >
          <Plus className="h-4 w-4" /> Nova recenzija
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-gold-dark" />
        </div>
      ) : !campaigns?.length ? (
        <div className="rounded-2xl border border-dashed border-ink/15 py-16 text-center">
          <Star className="mx-auto mb-3 h-8 w-8 text-ink/20" />
          <p className="text-sm text-ink/50">
            Još nema recenzija. Klikni <strong>Nova recenzija</strong> da napraviš prvi link.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {campaigns.map((c) => (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col rounded-2xl border border-ink/8 bg-white p-5 shadow-soft"
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                {c.logoPath ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={imageUrl(c.logoPath)!}
                    alt=""
                    className="h-12 w-12 rounded-xl object-cover"
                  />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gold/10">
                    <Star className="h-5 w-5 text-gold-dark" />
                  </div>
                )}
                <button
                  onClick={() => copyLink(c)}
                  title="Kopiraj link"
                  className="rounded-lg border border-ink/10 p-2 text-ink/50 transition-colors hover:border-gold hover:text-gold-dark"
                >
                  {copied === c.id ? (
                    <Check className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <Link2 className="h-4 w-4" />
                  )}
                </button>
              </div>

              <h3 className="font-display text-lg font-bold leading-tight">{c.name}</h3>
              <p className="mt-1 truncate font-mono text-[11px] text-ink/40">
                {c.googleReviewUrl || 'Bez Google linka'}
              </p>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                    c.gateEnabled ? 'bg-emerald-500/10 text-emerald-600' : 'bg-ink/5 text-ink/45'
                  }`}
                >
                  <ShieldCheck className="h-3 w-3" />
                  {c.gateEnabled ? 'Zaštita uključena' : 'Zaštita isključena'}
                </span>
                {(c._count?.feedback ?? 0) > 0 && (
                  <button
                    onClick={() => setFeedbackFor(c)}
                    className="inline-flex items-center gap-1 rounded-full bg-amber-400/15 px-2 py-0.5 text-[11px] font-medium text-amber-700 hover:bg-amber-400/25"
                  >
                    <MessageSquareWarning className="h-3 w-3" />
                    {c._count!.feedback} žalbi
                  </button>
                )}
              </div>

              <div className="mt-4 flex gap-1.5 border-t border-ink/6 pt-3">
                <CardBtn onClick={() => setQrFor(c)} icon={QrCode} label="QR" />
                <CardBtn onClick={() => setEditing(c)} icon={Pencil} label="Uredi" />
                <CardBtn
                  onClick={() => confirm(`Obrisati recenziju "${c.name}"?`) && del.mutate(c.id)}
                  icon={Trash2}
                  label="Obriši"
                  danger
                />
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {editing && (
          <CampaignModal
            campaign={editing === 'new' ? null : editing}
            onClose={() => setEditing(null)}
            onSaved={() => {
              setEditing(null);
              qc.invalidateQueries({ queryKey: ['reviewCampaigns'] });
            }}
          />
        )}
        {feedbackFor && (
          <FeedbackModal campaign={feedbackFor} onClose={() => setFeedbackFor(null)} />
        )}
      </AnimatePresence>

      {qrFor && (
        <QrModal
          open={!!qrFor}
          onClose={() => setQrFor(null)}
          title={qrFor.name}
          url={publicUrl(qrFor.slug)}
        />
      )}
    </div>
  );
}

function CardBtn({
  onClick,
  icon: Icon,
  label,
  danger,
}: {
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium transition-colors ${
        danger
          ? 'text-ink/50 hover:bg-red-50 hover:text-red-600'
          : 'text-ink/60 hover:bg-ink/5 hover:text-ink'
      }`}
    >
      <Icon className="h-3.5 w-3.5" /> {label}
    </button>
  );
}

// ---------------------------------------------------------------
// Kreiranje / izmjena kampanje
// ---------------------------------------------------------------
function CampaignModal({
  campaign,
  onClose,
  onSaved,
}: {
  campaign: Campaign | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(campaign?.name ?? '');
  const [url, setUrl] = useState(campaign?.googleReviewUrl ?? '');
  const [gate, setGate] = useState(campaign?.gateEnabled ?? true);
  const [logoPath, setLogoPath] = useState(campaign?.logoPath ?? null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const logoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!file) return setPreview(null);
    const u = URL.createObjectURL(file);
    setPreview(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);

  const uploadLogo = async (id: number) => {
    if (!file) return;
    const form = new FormData();
    form.append('image', file);
    const res = await fetch(`${API_URL}/api/reviews/${id}/logo`, {
      method: 'POST',
      credentials: 'include',
      body: form,
    });
    if (!res.ok) throw new Error((await res.json()).error ?? 'Slanje logotipa nije uspjelo');
  };

  const save = async () => {
    if (!name.trim()) return setError('Naziv je obavezan');
    setSaving(true);
    setError(null);
    try {
      const body = JSON.stringify({ name: name.trim(), googleReviewUrl: url.trim(), gateEnabled: gate });
      if (campaign) {
        await api(`/api/reviews/${campaign.id}`, { method: 'PATCH', body });
        await uploadLogo(campaign.id);
      } else {
        const created = await api<Campaign>('/api/reviews', { method: 'POST', body });
        await uploadLogo(created.id);
      }
      onSaved();
    } catch (e) {
      setError(e instanceof ApiError || e instanceof Error ? e.message : 'Greška pri spremanju');
      setSaving(false);
    }
  };

  const input =
    'w-full rounded-lg border border-ink/12 bg-white px-3 py-2.5 text-sm outline-none transition-colors focus:border-gold';
  const shownLogo = preview ?? (logoPath ? imageUrl(logoPath) : null);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-lifted"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 flex items-center justify-between">
          <h3 className="font-display text-lg font-bold">
            {campaign ? 'Uredi recenziju' : 'Nova recenzija'}
          </h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-ink/40 hover:bg-ink/5 hover:text-ink">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mb-4 text-sm text-ink/50">Konfiguriši link za Google recenzije.</p>

        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-ink/50">Naziv kampanje</span>
            <input
              autoFocus
              placeholder="Npr. Glavni restoran"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={input}
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-ink/50">Google recenzija link</span>
            <input
              placeholder="https://g.page/r/.../review"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className={input}
            />
          </label>

          <div>
            <span className="mb-1 block text-xs font-medium text-ink/50">Logo (opcionalno)</span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => logoRef.current?.click()}
                className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-dashed border-ink/20 text-ink/35 transition-colors hover:border-gold hover:text-gold-dark"
              >
                {shownLogo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={shownLogo} alt="" className="h-full w-full object-cover" />
                ) : (
                  <ImagePlus className="h-5 w-5" />
                )}
              </button>
              <div className="text-xs text-ink/45">
                <button
                  type="button"
                  onClick={() => logoRef.current?.click()}
                  className="font-medium text-gold-dark hover:underline"
                >
                  Odaberi sliku
                </button>
                {(shownLogo) && (
                  <button
                    type="button"
                    onClick={() => {
                      setFile(null);
                      setLogoPath(null);
                    }}
                    className="ml-3 text-red-500 hover:underline"
                  >
                    Ukloni
                  </button>
                )}
              </div>
            </div>
            <input
              ref={logoRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && setFile(e.target.files[0])}
            />
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-ink/8 bg-gold/[0.04] p-3">
            <input
              type="checkbox"
              checked={gate}
              onChange={(e) => setGate(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-[#d4af37]"
            />
            <span className="text-sm">
              <strong>Pametna zaštita (4+ zvjezdice)</strong>
              <span className="block text-xs text-ink/45">
                Gosti koji daju 1–3 zvjezdice ne idu na Google — ostave privatnu žalbu koju vidiš u
                adminu.
              </span>
            </span>
          </label>
        </div>

        {error && <p className="mt-3 text-sm text-red-500">{error}</p>}

        <div className="mt-5 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-full border border-ink/12 py-2.5 text-sm font-medium text-ink/60 transition-colors hover:bg-ink/5"
          >
            Odustani
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="btn-glossy flex flex-1 items-center justify-center gap-2 rounded-full bg-ink py-2.5 text-sm font-semibold text-cream disabled:opacity-50"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Sačuvaj
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ---------------------------------------------------------------
// Žalbe (ocjene < 4)
// ---------------------------------------------------------------
function FeedbackModal({ campaign, onClose }: { campaign: Campaign; onClose: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ['reviewFeedback', campaign.id],
    queryFn: () => api<{ feedback: Feedback[] }>(`/api/reviews/${campaign.id}`),
  });

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
        className="flex max-h-[80vh] w-full max-w-md flex-col rounded-2xl bg-white p-6 shadow-lifted"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-lg font-bold">Žalbe · {campaign.name}</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-ink/40 hover:bg-ink/5 hover:text-ink">
            <X className="h-4 w-4" />
          </button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-gold-dark" />
          </div>
        ) : !data?.feedback.length ? (
          <p className="py-8 text-center text-sm text-ink/40">Nema žalbi.</p>
        ) : (
          <div className="space-y-2 overflow-y-auto">
            {data.feedback.map((f) => (
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
      </motion.div>
    </motion.div>
  );
}
