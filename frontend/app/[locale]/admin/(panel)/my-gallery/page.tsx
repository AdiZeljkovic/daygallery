'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'motion/react';
import {
  Images,
  QrCode,
  Copy,
  Check,
  ExternalLink,
  Download,
  Loader2,
  Camera,
  Heart,
  Info,
} from 'lucide-react';
import { api, authApi } from '@/lib/api';
import { imageUrl } from '@/lib/menuTypes';
import { QrModal } from '@/components/admin/QrModal';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

interface EventImage {
  id: number;
  filePath: string;
  thumbPath: string;
  uploadedAt: string;
}

interface EventDetail {
  id: number;
  slug: string;
  name: string;
  eventDate: string | null;
  clientNames: string | null;
  images: EventImage[]; // vlasnik dobija samo odobrene
}

export default function MyGalleryPage() {
  const { data: user } = useQuery({ queryKey: ['me'], queryFn: authApi.me, retry: false });
  const eventId = user?.events?.[0]?.id;

  const { data: event, isLoading } = useQuery({
    queryKey: ['event', eventId],
    queryFn: () => api<EventDetail>(`/api/events/${eventId}`),
    enabled: !!eventId,
    refetchInterval: 60_000,
  });

  const [qrModal, setQrModal] = useState<'upload' | 'gallery' | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [zipLoading, setZipLoading] = useState(false);

  if (isLoading || !user) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-gold-dark" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="rounded-xl border border-dashed border-ink/15 py-20 text-center">
        <Images className="mx-auto mb-3 h-8 w-8 text-ink/20" />
        <p className="text-ink/40">Galerija još nije postavljena — kontaktirajte nas.</p>
      </div>
    );
  }

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const uploadUrl = `${origin}/g/${event.slug}`;
  const galleryUrl = `${origin}/gallery/${event.slug}`;

  const copyLink = async (url: string, key: string) => {
    await navigator.clipboard.writeText(url);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  const downloadZip = async () => {
    setZipLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/events/${event.id}/images/zip`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Greška');
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${event.name.replaceAll(' ', '_')}_slike.zip`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Preuzimanje nije uspjelo');
    } finally {
      setZipLoading(false);
    }
  };

  return (
    <div className="max-w-4xl">
      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8 text-center"
      >
        <Heart className="mx-auto mb-3 h-8 w-8 fill-gold/60 text-gold" />
        <h1 className="font-display text-3xl font-bold">{event.clientNames || event.name}</h1>
        <p className="mt-1 text-sm text-ink/50">
          {event.eventDate &&
            new Date(event.eventDate).toLocaleDateString('bs-BA', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          {' · '}
          <strong>{event.images.length}</strong> odobrenih uspomena
        </p>
      </motion.div>

      {/* Linkovi — 2 QR kartice */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2">
        <LinkCard
          icon={Camera}
          title="Pozivnica za goste"
          desc="Gosti skeniraju i šalju svoje slike — bez aplikacije."
          url={uploadUrl}
          copied={copied === 'upload'}
          onCopy={() => copyLink(uploadUrl, 'upload')}
          onQr={() => setQrModal('upload')}
        />
        <LinkCard
          icon={Images}
          title="Link galerije"
          desc="Podijelite sa porodicom — svi vide odobrene slike."
          url={galleryUrl}
          copied={copied === 'gallery'}
          onCopy={() => copyLink(galleryUrl, 'gallery')}
          onQr={() => setQrModal('gallery')}
        />
      </div>

      {/* Akcije */}
      <div className="mb-8 flex flex-wrap justify-center gap-3">
        <a
          href={galleryUrl}
          target="_blank"
          rel="noreferrer"
          className="btn-glossy flex items-center gap-2 rounded-full bg-gold px-6 py-3 font-semibold text-neutral-900"
        >
          <ExternalLink className="h-4 w-4" />
          Otvori galeriju
        </a>
        <button
          onClick={downloadZip}
          disabled={zipLoading || event.images.length === 0}
          className="flex items-center gap-2 rounded-full bg-ink px-6 py-3 font-semibold text-cream transition-colors hover:bg-ink-soft disabled:opacity-40"
        >
          {zipLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Preuzmi sve slike (.zip)
        </button>
      </div>

      <div className="mb-8 flex items-start gap-2.5 rounded-xl bg-gold/8 px-4 py-3 text-sm text-ink/60">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-gold-dark" />
        <p>
          Slike koje gosti pošalju prvo pregleda naš tim (do 24h) — nakon odobrenja se automatski
          pojavljuju ovdje i u vašoj galeriji.
        </p>
      </div>

      {/* Grid slika */}
      {event.images.length === 0 ? (
        <div className="rounded-xl border border-dashed border-ink/15 py-16 text-center">
          <Camera className="mx-auto mb-3 h-8 w-8 text-ink/20" />
          <p className="text-ink/40">Još nema odobrenih slika.</p>
          <p className="mt-1 text-sm text-ink/30">Podijelite pozivnicu gostima da počnu slati uspomene!</p>
        </div>
      ) : (
        <div className="columns-2 gap-3 sm:columns-3 lg:columns-4">
          {event.images.map((image, i) => (
            <motion.div
              key={image.id}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.03, 0.4) }}
              className="mb-3 overflow-hidden rounded-xl"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageUrl(image.thumbPath)!} alt="" loading="lazy" className="w-full" />
            </motion.div>
          ))}
        </div>
      )}

      <QrModal
        open={qrModal === 'upload'}
        onClose={() => setQrModal(null)}
        title="Pozivnica za goste"
        url={uploadUrl}
      />
      <QrModal
        open={qrModal === 'gallery'}
        onClose={() => setQrModal(null)}
        title="Vaša galerija"
        url={galleryUrl}
      />
    </div>
  );
}

function LinkCard({
  icon: Icon,
  title,
  desc,
  url,
  copied,
  onCopy,
  onQr,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc: string;
  url: string;
  copied: boolean;
  onCopy: () => void;
  onQr: () => void;
}) {
  return (
    <div className="rounded-2xl border border-ink/8 bg-white p-5 shadow-soft">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gold/12">
          <Icon className="h-5 w-5 text-gold-dark" />
        </span>
        <div>
          <h3 className="font-semibold">{title}</h3>
          <p className="text-xs text-ink/45">{desc}</p>
        </div>
      </div>
      <code className="mt-3 block truncate rounded-lg bg-ink/[0.04] px-3 py-2 text-xs text-ink/55">
        {url}
      </code>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          onClick={onCopy}
          className="flex items-center justify-center gap-1.5 rounded-lg border border-ink/10 py-2 text-xs font-medium transition-colors hover:border-gold hover:text-gold-dark"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? 'Kopirano' : 'Kopiraj link'}
        </button>
        <button
          onClick={onQr}
          className="btn-glossy flex items-center justify-center gap-1.5 rounded-full bg-gold py-2 text-xs font-semibold text-neutral-900"
        >
          <QrCode className="h-3.5 w-3.5" />
          QR kod
        </button>
      </div>
    </div>
  );
}
