'use client';

import { useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'motion/react';
import {
  Store,
  Plus,
  QrCode,
  Copy,
  Check,
  ExternalLink,
  UtensilsCrossed,
  BellRing,
  Trash2,
  Pencil,
  Loader2,
  X,
  ImagePlus,
} from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { api, ApiError, authApi } from '@/lib/api';
import { imageUrl, type VenueTheme } from '@/lib/menuTypes';
import { QrModal } from '@/components/admin/QrModal';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

interface VenueRow {
  id: number;
  slug: string;
  name: string;
  address: string | null;
  phone: string | null;
  currency: string;
  isActive: boolean;
  logoPath?: string | null;
  theme?: VenueTheme | null;
  googleReviewUrl?: string | null;
  owner?: { id: number; name: string; email: string };
  group?: { id: number; name: string } | null;
}

export default function VenuesPage() {
  const qc = useQueryClient();
  const [qrVenue, setQrVenue] = useState<VenueRow | null>(null);
  const [editVenue, setEditVenue] = useState<VenueRow | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const { data: user } = useQuery({ queryKey: ['me'], queryFn: authApi.me, retry: false });
  const { data: venues, isLoading } = useQuery({
    queryKey: ['venues'],
    queryFn: () => api<VenueRow[]>('/api/venues'),
  });

  const deleteVenue = useMutation({
    mutationFn: (id: number) => api(`/api/venues/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['venues'] }),
  });

  const isSuperadmin = user?.role === 'superadmin';
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const menuUrl = (venue: VenueRow) => `${origin}/m/${venue.slug}`;

  const copyLink = async (venue: VenueRow) => {
    await navigator.clipboard.writeText(menuUrl(venue));
    setCopiedId(venue.id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold">Objekti</h1>
          <p className="mt-1 text-sm text-ink/50">Kafići i restorani sa digitalnim menijem</p>
        </div>
        {isSuperadmin && (
          <button
            onClick={() => setCreateOpen(true)}
            className="btn-glossy flex items-center gap-2 rounded-full bg-gold px-4 py-2.5 text-sm font-semibold text-neutral-900 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Novi objekat
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-gold-dark" />
        </div>
      ) : !venues?.length ? (
        <div className="rounded-xl border border-dashed border-ink/15 py-20 text-center">
          <Store className="mx-auto mb-3 h-8 w-8 text-ink/20" />
          <p className="text-ink/40">Nema objekata još.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {venues.map((venue, i) => (
            <motion.div
              key={venue.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="rounded-xl border border-ink/8 bg-white p-4 shadow-soft"
            >
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gold/12">
                  <Store className="h-5 w-5 text-gold-dark" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate font-semibold">{venue.name}</h3>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        venue.isActive ? 'bg-emerald-50 text-emerald-600' : 'bg-ink/5 text-ink/40'
                      }`}
                    >
                      {venue.isActive ? 'Aktivan' : 'Neaktivan'}
                    </span>
                  </div>
                  <p className="truncate text-sm text-ink/45">
                    {venue.address}
                    {isSuperadmin && venue.owner && ` · Vlasnik: ${venue.owner.name}`}
                    {isSuperadmin && venue.group && ` · Grupa: ${venue.group.name}`}
                  </p>
                </div>

                <Link
                  href={`/admin/venues/${venue.id}/menu`}
                  className="flex items-center gap-1.5 rounded-lg bg-ink/5 px-3 py-2 text-xs font-medium text-ink/60 transition-colors hover:bg-gold/10 hover:text-gold-dark"
                >
                  <UtensilsCrossed className="h-3.5 w-3.5" /> Meni
                </Link>
                <Link
                  href={`/admin/venues/${venue.id}/orders`}
                  className="flex items-center gap-1.5 rounded-lg bg-ink/5 px-3 py-2 text-xs font-medium text-ink/60 transition-colors hover:bg-gold/10 hover:text-gold-dark"
                >
                  <BellRing className="h-3.5 w-3.5" /> Narudžbe
                </Link>

                {isSuperadmin && (
                  <>
                    <button
                      onClick={() => setEditVenue(venue)}
                      className="rounded-lg p-2 text-ink/40 transition-colors hover:bg-ink/5 hover:text-ink"
                      title="Uredi"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Obrisati objekat "${venue.name}" i sve njegove podatke?`))
                          deleteVenue.mutate(venue.id);
                      }}
                      className="rounded-lg p-2 text-ink/40 transition-colors hover:bg-red-50 hover:text-red-500"
                      title="Obriši"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </>
                )}
              </div>

              {/* Javni link menija */}
              <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-ink/[0.03] px-3 py-2.5">
                <span className="text-xs font-medium uppercase tracking-wider text-ink/40">
                  Javni meni:
                </span>
                <code className="min-w-0 flex-1 truncate text-xs text-ink/60">{menuUrl(venue)}</code>
                <button
                  onClick={() => copyLink(venue)}
                  className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-ink/50 transition-colors hover:bg-white hover:text-ink"
                >
                  {copiedId === venue.id ? (
                    <Check className="h-3.5 w-3.5 text-emerald-500" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  {copiedId === venue.id ? 'Kopirano' : 'Kopiraj'}
                </button>
                <a
                  href={menuUrl(venue)}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-ink/50 transition-colors hover:bg-white hover:text-ink"
                >
                  <ExternalLink className="h-3.5 w-3.5" /> Otvori
                </a>
                <button
                  onClick={() => setQrVenue(venue)}
                  className="btn-glossy flex items-center gap-1 rounded-md bg-gold px-2.5 py-1 text-xs font-semibold text-neutral-900 transition-colors"
                >
                  <QrCode className="h-3.5 w-3.5" /> QR kod
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {qrVenue && (
        <QrModal open onClose={() => setQrVenue(null)} title={qrVenue.name} url={menuUrl(qrVenue)} />
      )}
      {(createOpen || editVenue) && (
        <VenueModal
          venue={editVenue ?? undefined}
          onClose={() => {
            setCreateOpen(false);
            setEditVenue(null);
          }}
          onSaved={() => {
            setCreateOpen(false);
            setEditVenue(null);
            qc.invalidateQueries({ queryKey: ['venues'] });
          }}
        />
      )}
    </div>
  );
}

function VenueModal({
  venue,
  onClose,
  onSaved,
}: {
  venue?: VenueRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(venue?.name ?? '');
  const [address, setAddress] = useState(venue?.address ?? '');
  const [phone, setPhone] = useState(venue?.phone ?? '');
  const [currency, setCurrency] = useState(venue?.currency ?? 'BAM');
  const [ownerUserId, setOwnerUserId] = useState<string>(venue?.owner?.id.toString() ?? '');
  const [groupId, setGroupId] = useState<string>(venue?.group?.id.toString() ?? '');
  const [primaryColor, setPrimaryColor] = useState(venue?.theme?.primaryColor ?? '#d4af37');
  const [googleReviewUrl, setGoogleReviewUrl] = useState(venue?.googleReviewUrl ?? '');
  const [logoPath, setLogoPath] = useState(venue?.logoPath ?? null);
  const [bgPath, setBgPath] = useState(venue?.theme?.backgroundImagePath ?? null);
  const [uploading, setUploading] = useState<'logo' | 'background' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const logoRef = useRef<HTMLInputElement>(null);
  const bgRef = useRef<HTMLInputElement>(null);

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: () => api<{ id: number; name: string; email: string; role: string }[]>('/api/users'),
  });

  const { data: groups } = useQuery({
    queryKey: ['groups'],
    queryFn: () => api<{ id: number; name: string; members: unknown[] }[]>('/api/groups'),
  });

  const save = useMutation({
    mutationFn: async () => {
      const base = {
        name,
        address,
        phone,
        currency,
        googleReviewUrl: googleReviewUrl || '',
        theme: { primaryColor },
        ownerUserId: ownerUserId ? Number(ownerUserId) : undefined,
      };
      if (venue) {
        return api(`/api/venues/${venue.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ ...base, groupId: groupId ? Number(groupId) : null }),
        });
      }
      // create pa (ako je izabrana grupa) odmah dodijeli
      const created = await api<{ id: number }>('/api/venues', {
        method: 'POST',
        body: JSON.stringify(base),
      });
      if (groupId) {
        await api(`/api/venues/${created.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ groupId: Number(groupId) }),
        });
      }
      return created;
    },
    onSuccess: onSaved,
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Greška'),
  });

  const uploadBranding = async (kind: 'logo' | 'background', file: File) => {
    if (!venue) return;
    setUploading(kind);
    setError(null);
    try {
      const form = new FormData();
      form.append('image', file);
      const res = await fetch(`${API_URL}/api/venues/${venue.id}/${kind}`, {
        method: 'POST',
        credentials: 'include',
        body: form,
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Slanje nije uspjelo');
      const updated = await res.json();
      if (kind === 'logo') setLogoPath(updated.logoPath);
      else setBgPath(updated.theme?.backgroundImagePath ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Slanje nije uspjelo');
    } finally {
      setUploading(null);
    }
  };

  const input =
    'w-full rounded-lg border border-ink/12 px-3 py-2 text-sm outline-none transition-colors focus:border-gold';

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
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-lg font-bold">
            {venue ? 'Uredi objekat' : 'Novi objekat'}
          </h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-ink/40 hover:bg-ink/5 hover:text-ink">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3">
          <input autoFocus placeholder="Naziv (npr. Caffe Central)" value={name} onChange={(e) => setName(e.target.value)} className={input} />
          <input placeholder="Adresa" value={address} onChange={(e) => setAddress(e.target.value)} className={input} />
          <div className="flex gap-2">
            <input placeholder="Telefon" value={phone} onChange={(e) => setPhone(e.target.value)} className={input} />
            <input placeholder="Valuta" value={currency} onChange={(e) => setCurrency(e.target.value)} className={`${input} w-24 shrink-0`} />
          </div>
          <input placeholder="Google recenzija link (opcionalno)" value={googleReviewUrl} onChange={(e) => setGoogleReviewUrl(e.target.value)} className={input} />
          <select value={ownerUserId} onChange={(e) => setOwnerUserId(e.target.value)} className={`${input} bg-white`}>
            <option value="">Vlasnik: ja (superadmin)</option>
            {users
              ?.filter((u) => u.role === 'client')
              .map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.email})
                </option>
              ))}
          </select>

          <div>
            <select value={groupId} onChange={(e) => setGroupId(e.target.value)} className={`${input} bg-white`}>
              <option value="">Bez grupe naloga</option>
              {groups?.map((g) => (
                <option key={g.id} value={g.id}>
                  Grupa: {g.name} ({g.members.length} nalog{g.members.length === 1 ? '' : 'a'})
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-ink/40">
              Svi nalozi iz grupe dobijaju pristup ovom objektu (grupe praviš u „Korisnici").
            </p>
          </div>

          {/* Branding */}
          <div className="rounded-xl border border-ink/8 p-3">
            <p className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-ink/45">
              Branding menija
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => venue && logoRef.current?.click()}
                disabled={!venue || uploading === 'logo'}
                title={venue ? 'Logo' : 'Dostupno nakon kreiranja'}
                className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-dashed border-ink/20 text-ink/30 transition-colors hover:border-gold hover:text-gold-dark disabled:cursor-not-allowed"
              >
                {logoPath ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={imageUrl(logoPath)!} alt="logo" className="h-full w-full object-cover" />
                ) : uploading === 'logo' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ImagePlus className="h-4 w-4" />
                )}
              </button>
              <button
                type="button"
                onClick={() => venue && bgRef.current?.click()}
                disabled={!venue || uploading === 'background'}
                title={venue ? 'Pozadinska slika menija' : 'Dostupno nakon kreiranja'}
                className="relative flex h-16 flex-1 items-center justify-center overflow-hidden rounded-xl border border-dashed border-ink/20 text-ink/30 transition-colors hover:border-gold hover:text-gold-dark disabled:cursor-not-allowed"
              >
                {bgPath ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={imageUrl(bgPath)!} alt="pozadina" className="h-full w-full object-cover" />
                ) : uploading === 'background' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <span className="flex items-center gap-1.5 text-xs">
                    <ImagePlus className="h-4 w-4" /> Pozadina
                  </span>
                )}
              </button>
              <label className="flex shrink-0 cursor-pointer flex-col items-center gap-1" title="Brend boja">
                <input
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="h-10 w-10 cursor-pointer rounded-lg border border-ink/10"
                />
                <span className="text-[10px] text-ink/40">Boja</span>
              </label>
            </div>
            {!venue && (
              <p className="mt-2 text-[11px] text-ink/35">Slike se dodaju nakon prvog spremanja.</p>
            )}
            <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadBranding('logo', e.target.files[0])} />
            <input ref={bgRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadBranding('background', e.target.files[0])} />
          </div>
        </div>

        {error && <p className="mt-3 text-sm text-red-500">{error}</p>}

        <button
          onClick={() => save.mutate()}
          disabled={!name.trim() || save.isPending}
          className="btn-glossy mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-gold py-2.5 text-sm font-semibold text-neutral-900 transition-colors disabled:opacity-50"
        >
          {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          {venue ? 'Sačuvaj izmjene' : 'Kreiraj objekat'}
        </button>
      </motion.div>
    </motion.div>
  );
}
