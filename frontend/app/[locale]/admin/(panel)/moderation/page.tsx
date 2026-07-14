'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'motion/react';
import { Check, CheckCheck, Trash2, Loader2, ShieldCheck, Clock } from 'lucide-react';
import { api } from '@/lib/api';
import { imageUrl } from '@/lib/menuTypes';

interface PendingImage {
  id: number;
  filePath: string;
  thumbPath: string;
  uploadedAt: string;
  event: { id: number; name: string; clientNames: string | null };
}

/** "prije 3h" formatiranje + upozorenje ako se bliži rok od 24h */
function age(uploadedAt: string) {
  const hours = (Date.now() - new Date(uploadedAt).getTime()) / 3_600_000;
  const label =
    hours < 1
      ? `prije ${Math.max(1, Math.round(hours * 60))} min`
      : hours < 24
        ? `prije ${Math.round(hours)}h`
        : `prije ${Math.round(hours / 24)}d`;
  return { label, urgent: hours >= 20 };
}

export default function ModerationPage() {
  const qc = useQueryClient();
  const [preview, setPreview] = useState<PendingImage | null>(null);

  const { data: images, isLoading } = useQuery({
    queryKey: ['moderationPending'],
    queryFn: () => api<PendingImage[]>('/api/events/moderation/pending'),
    refetchInterval: 30_000,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['moderationPending'] });

  const approve = useMutation({
    mutationFn: (imageId: number) =>
      api(`/api/events/images/${imageId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'approved' }),
      }),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (imageId: number) => api(`/api/events/images/${imageId}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  });

  const approveAll = useMutation({
    mutationFn: () => api('/api/events/moderation/approve-all', { method: 'POST' }),
    onSuccess: invalidate,
  });

  // grupiši po galeriji
  const byEvent = new Map<number, { name: string; images: PendingImage[] }>();
  for (const image of images ?? []) {
    const group = byEvent.get(image.event.id) ?? {
      name: image.event.clientNames || image.event.name,
      images: [],
    };
    group.images.push(image);
    byEvent.set(image.event.id, group);
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Moderacija</h1>
          <p className="mt-1 text-sm text-ink/50">
            Slike gostiju čekaju tvoje odobrenje — rok je 24 sata od slanja.
          </p>
        </div>
        {(images?.length ?? 0) > 0 && (
          <button
            onClick={() => approveAll.mutate()}
            disabled={approveAll.isPending}
            className="btn-glossy flex items-center gap-2 rounded-full bg-gold px-4 py-2.5 text-sm font-semibold text-neutral-900"
          >
            {approveAll.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCheck className="h-4 w-4" />
            )}
            Odobri sve ({images?.length})
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-gold-dark" />
        </div>
      ) : !images?.length ? (
        <div className="rounded-xl border border-dashed border-ink/15 py-20 text-center">
          <ShieldCheck className="mx-auto mb-3 h-9 w-9 text-emerald-500" />
          <p className="font-semibold">Sve je pregledano! 🎉</p>
          <p className="mt-1 text-sm text-ink/40">Nema slika koje čekaju odobrenje.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {[...byEvent.entries()].map(([eventId, group]) => (
            <section key={eventId}>
              <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-bold">
                {group.name}
                <span className="rounded-full bg-amber-400 px-2 py-0.5 text-xs font-bold text-neutral-900">
                  {group.images.length}
                </span>
              </h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                <AnimatePresence initial={false}>
                  {group.images.map((image) => {
                    const imageAge = age(image.uploadedAt);
                    return (
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
                          onClick={() => setPreview(image)}
                          className="h-full w-full cursor-zoom-in object-cover"
                        />
                        <span
                          className={`absolute left-2 top-2 flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            imageAge.urgent ? 'bg-red-500 text-[#fff]' : 'bg-[#000]/60 text-[#fff] backdrop-blur'
                          }`}
                        >
                          <Clock className="h-2.5 w-2.5" />
                          {imageAge.label}
                        </span>
                        <div className="absolute inset-x-0 bottom-0 grid grid-cols-2 gap-1 bg-gradient-to-t from-[#000]/70 to-transparent p-2">
                          <button
                            onClick={() => approve.mutate(image.id)}
                            className="flex items-center justify-center gap-1 rounded-lg bg-emerald-500 py-1.5 text-xs font-bold text-[#fff] transition-transform hover:scale-[1.03]"
                          >
                            <Check className="h-3.5 w-3.5" /> Odobri
                          </button>
                          <button
                            onClick={() => remove.mutate(image.id)}
                            className="flex items-center justify-center gap-1 rounded-lg bg-[#fff]/90 py-1.5 text-xs font-bold text-red-500 transition-transform hover:scale-[1.03]"
                          >
                            <Trash2 className="h-3.5 w-3.5" /> Obriši
                          </button>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            </section>
          ))}
        </div>
      )}

      {/* Preview */}
      <AnimatePresence>
        {preview && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-4"
            onClick={() => setPreview(null)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl(preview.filePath)!}
              alt=""
              className="max-h-[80vh] max-w-[90vw] rounded-lg object-contain"
            />
            <div className="absolute bottom-6 flex gap-3">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  approve.mutate(preview.id);
                  setPreview(null);
                }}
                className="flex items-center gap-2 rounded-full bg-emerald-500 px-6 py-3 font-semibold text-[#fff]"
              >
                <Check className="h-5 w-5" /> Odobri
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  remove.mutate(preview.id);
                  setPreview(null);
                }}
                className="flex items-center gap-2 rounded-full bg-[#fff] px-6 py-3 font-semibold text-red-500"
              >
                <Trash2 className="h-5 w-5" /> Obriši
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
