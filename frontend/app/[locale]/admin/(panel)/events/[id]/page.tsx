'use client';

import { use, useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft,
  QrCode,
  Images,
  Download,
  Check,
  CheckCheck,
  Trash2,
  Star,
  ImageIcon,
  Loader2,
  Globe,
  ShieldCheck,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { imageUrl } from '@/lib/menuTypes';
import { QrModal } from '@/components/admin/QrModal';
import { EventTabs } from '@/components/admin/EventTabs';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

interface EventImage {
  id: number;
  filePath: string;
  thumbPath: string;
  status: 'pending' | 'approved';
  inPublicGallery: boolean;
  uploadedAt: string;
}

interface EventDetail {
  id: number;
  slug: string;
  name: string;
  eventDate: string | null;
  clientNames: string | null;
  isPublicGallery: boolean;
  autoApprove: boolean;
  coverImageId: number | null;
  images: EventImage[];
}

export default function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const eventId = Number(id);
  const qc = useQueryClient();

  const [qrModal, setQrModal] = useState<'upload' | 'gallery' | null>(null);
  const [lightbox, setLightbox] = useState<number | null>(null); // index
  const [filter, setFilter] = useState<'all' | 'pending'>('all');
  const [zipLoading, setZipLoading] = useState(false);

  const { data: event, isLoading } = useQuery({
    queryKey: ['event', eventId],
    queryFn: () => api<EventDetail>(`/api/events/${eventId}`),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['event', eventId] });

  // Live: nove gostove slike
  useEffect(() => {
    const socket = getSocket();
    const subscribe = () => socket.emit('event:subscribe', eventId);
    if (socket.connected) subscribe();
    socket.on('connect', subscribe);
    const onNew = () => invalidate();
    socket.on('gallery:new', onNew);
    return () => {
      socket.emit('event:unsubscribe', eventId);
      socket.off('connect', subscribe);
      socket.off('gallery:new', onNew);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  const patchImage = useMutation({
    mutationFn: ({ imageId, data }: { imageId: number; data: Record<string, unknown> }) =>
      api(`/api/events/images/${imageId}`, { method: 'PATCH', body: JSON.stringify(data) }),
    onSuccess: invalidate,
  });

  const deleteImage = useMutation({
    mutationFn: (imageId: number) => api(`/api/events/images/${imageId}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  });

  const approveAll = useMutation({
    mutationFn: () => api(`/api/events/${eventId}/images/approve-all`, { method: 'POST' }),
    onSuccess: invalidate,
  });

  const setCover = useMutation({
    mutationFn: (imageId: number) => api(`/api/events/${eventId}/cover/${imageId}`, { method: 'POST' }),
    onSuccess: invalidate,
  });

  const patchEvent = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      api(`/api/events/${eventId}`, { method: 'PATCH', body: JSON.stringify(data) }),
    onSuccess: invalidate,
  });

  const downloadZip = async () => {
    setZipLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/events/${eventId}/images/zip`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Greška');
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${event?.name.replaceAll(' ', '_')}_slike.zip`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Download nije uspio');
    } finally {
      setZipLoading(false);
    }
  };

  if (isLoading || !event) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-gold-dark" />
      </div>
    );
  }

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const pending = event.images.filter((i) => i.status === 'pending');
  const shown = filter === 'pending' ? pending : event.images;
  const approvedCount = event.images.length - pending.length;

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/events"
            className="rounded-lg p-2 text-ink/40 transition-colors hover:bg-ink/5 hover:text-ink"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="font-display text-2xl font-bold">{event.name}</h1>
            <p className="text-sm text-ink/45">
              {event.clientNames}
              {event.eventDate && ` · ${new Date(event.eventDate).toLocaleDateString('bs-BA')}`}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setQrModal('upload')}
            className="btn-glossy flex items-center gap-2 rounded-full bg-gold px-3.5 py-2 text-sm font-semibold text-neutral-900 transition-colors"
          >
            <QrCode className="h-4 w-4" /> QR upload
          </button>
          <button
            onClick={() => setQrModal('gallery')}
            className="flex items-center gap-2 rounded-lg border border-ink/12 px-3.5 py-2 text-sm font-medium transition-colors hover:border-gold hover:text-gold-dark"
          >
            <Images className="h-4 w-4" /> QR galerija
          </button>
          <button
            onClick={downloadZip}
            disabled={zipLoading || approvedCount === 0}
            className="flex items-center gap-2 rounded-lg bg-ink px-3.5 py-2 text-sm font-medium text-cream transition-colors hover:bg-ink-soft disabled:opacity-40"
          >
            {zipLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            ZIP ({approvedCount})
          </button>
        </div>
      </div>

      <EventTabs eventId={eventId} />

      {/* Postavke + filteri */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
              filter === 'all' ? 'bg-ink text-cream' : 'bg-ink/5 text-ink/55 hover:bg-ink/10'
            }`}
          >
            Sve ({event.images.length})
          </button>
          <button
            onClick={() => setFilter('pending')}
            className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
              filter === 'pending' ? 'bg-ink text-cream' : 'bg-ink/5 text-ink/55 hover:bg-ink/10'
            }`}
          >
            Na čekanju
            {pending.length > 0 && (
              <span className="ml-1.5 rounded-full bg-amber-400 px-1.5 text-[10px] font-bold text-neutral-900">
                {pending.length}
              </span>
            )}
          </button>
          {pending.length > 0 && (
            <button
              onClick={() => approveAll.mutate()}
              disabled={approveAll.isPending}
              className="flex items-center gap-1.5 rounded-full bg-emerald-500 px-3.5 py-1.5 text-xs font-semibold text-[#fff] transition-colors hover:bg-emerald-600"
            >
              <CheckCheck className="h-3.5 w-3.5" /> Odobri sve
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <ToggleChip
            active={event.isPublicGallery}
            icon={Globe}
            label="Javna galerija"
            onClick={() => patchEvent.mutate({ isPublicGallery: !event.isPublicGallery })}
          />
          <span className="flex items-center gap-1.5 rounded-full bg-ink/5 px-3.5 py-1.5 text-xs text-ink/45">
            <ShieldCheck className="h-3.5 w-3.5" />
            Sve slike čekaju odobrenje (24h)
          </span>
        </div>
      </div>

      {/* Grid slika */}
      {shown.length === 0 ? (
        <div className="rounded-xl border border-dashed border-ink/15 py-20 text-center">
          <ImageIcon className="mx-auto mb-3 h-8 w-8 text-ink/20" />
          <p className="text-ink/40">
            {filter === 'pending' ? 'Nema slika na čekanju.' : 'Nema slika još — podijelite QR kod gostima.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          <AnimatePresence initial={false}>
            {shown.map((image, index) => (
              <motion.div
                key={image.id}
                layout
                initial={{ opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="group relative aspect-square overflow-hidden rounded-xl bg-ink/5"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageUrl(image.thumbPath)!}
                  alt=""
                  loading="lazy"
                  onClick={() => setLightbox(index)}
                  className="h-full w-full cursor-zoom-in object-cover transition-transform duration-300 group-hover:scale-105"
                />

                {/* Badges */}
                <div className="pointer-events-none absolute left-2 top-2 flex gap-1">
                  {image.status === 'pending' && (
                    <span className="rounded-full bg-amber-400/95 px-2 py-0.5 text-[10px] font-bold text-ink">
                      Čeka
                    </span>
                  )}
                  {event.coverImageId === image.id && (
                    <span className="rounded-full bg-white/95 px-2 py-0.5 text-[10px] font-bold text-gold-dark">
                      Cover
                    </span>
                  )}
                  {image.inPublicGallery && (
                    <span className="rounded-full bg-gold/95 px-2 py-0.5 text-[10px] font-bold text-ink">
                      Javna
                    </span>
                  )}
                </div>

                {/* Akcije na hover */}
                <div className="absolute inset-x-0 bottom-0 flex justify-center gap-1 bg-gradient-to-t from-ink/70 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
                  {image.status === 'pending' && (
                    <IconAction
                      title="Odobri"
                      onClick={() => patchImage.mutate({ imageId: image.id, data: { status: 'approved' } })}
                    >
                      <Check className="h-3.5 w-3.5" />
                    </IconAction>
                  )}
                  <IconAction
                    title={image.inPublicGallery ? 'Ukloni iz javne galerije' : 'Dodaj u javnu galeriju'}
                    onClick={() =>
                      patchImage.mutate({
                        imageId: image.id,
                        data: { inPublicGallery: !image.inPublicGallery },
                      })
                    }
                  >
                    <Star
                      className={`h-3.5 w-3.5 ${image.inPublicGallery ? 'fill-gold text-gold' : ''}`}
                    />
                  </IconAction>
                  <IconAction title="Postavi kao cover" onClick={() => setCover.mutate(image.id)}>
                    <ImageIcon className="h-3.5 w-3.5" />
                  </IconAction>
                  <IconAction
                    title="Obriši"
                    onClick={() => confirm('Obrisati sliku?') && deleteImage.mutate(image.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </IconAction>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Lightbox */}
      <AnimatePresence>
        {lightbox !== null && shown[lightbox] && (
          <Lightbox
            images={shown}
            index={lightbox}
            onClose={() => setLightbox(null)}
            onNavigate={setLightbox}
          />
        )}
      </AnimatePresence>

      {/* QR modali */}
      <QrModal
        open={qrModal === 'upload'}
        onClose={() => setQrModal(null)}
        title={`${event.name} — Upload`}
        url={`${origin}/g/${event.slug}`}
      />
      <QrModal
        open={qrModal === 'gallery'}
        onClose={() => setQrModal(null)}
        title={`${event.name} — Galerija`}
        url={`${origin}/gallery/${event.slug}`}
      />
    </div>
  );
}

function ToggleChip({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
        active ? 'bg-gold/15 text-gold-dark' : 'bg-ink/5 text-ink/45 hover:bg-ink/10'
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
      <span
        className={`ml-1 inline-block h-1.5 w-1.5 rounded-full ${active ? 'bg-gold' : 'bg-ink/20'}`}
      />
    </button>
  );
}

function IconAction({
  title,
  onClick,
  children,
}: {
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className="rounded-lg bg-white/90 p-1.5 text-ink backdrop-blur transition-transform hover:scale-110"
    >
      {children}
    </button>
  );
}

function Lightbox({
  images,
  index,
  onClose,
  onNavigate,
}: {
  images: EventImage[];
  index: number;
  onClose: () => void;
  onNavigate: (i: number) => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') onNavigate((index - 1 + images.length) % images.length);
      if (e.key === 'ArrowRight') onNavigate((index + 1) % images.length);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, images.length, onClose, onNavigate]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-4"
      onClick={onClose}
    >
      <button className="absolute right-4 top-4 rounded-lg p-2 text-[#fff]/60 hover:text-[#fff]">
        <X className="h-6 w-6" />
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onNavigate((index - 1 + images.length) % images.length);
        }}
        className="absolute left-4 rounded-full bg-[#fff]/10 p-3 text-[#fff]/70 backdrop-blur transition-colors hover:bg-[#fff]/20 hover:text-[#fff]"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <motion.img
        key={images[index].id}
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        src={imageUrl(images[index].filePath)!}
        alt=""
        className="max-h-[88vh] max-w-[88vw] rounded-lg object-contain shadow-lifted"
        onClick={(e) => e.stopPropagation()}
      />
      <button
        onClick={(e) => {
          e.stopPropagation();
          onNavigate((index + 1) % images.length);
        }}
        className="absolute right-4 rounded-full bg-[#fff]/10 p-3 text-[#fff]/70 backdrop-blur transition-colors hover:bg-[#fff]/20 hover:text-[#fff]"
      >
        <ChevronRight className="h-5 w-5" />
      </button>
      <p className="absolute bottom-4 text-xs text-[#fff]/40">
        {index + 1} / {images.length}
      </p>
    </motion.div>
  );
}
