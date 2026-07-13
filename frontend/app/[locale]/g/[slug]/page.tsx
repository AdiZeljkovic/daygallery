'use client';

import { use, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'motion/react';
import { Camera, Heart, Loader2, CheckCircle2, ImagePlus, PartyPopper } from 'lucide-react';
import imageCompression from 'browser-image-compression';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { imageUrl } from '@/lib/menuTypes';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

interface EventInfo {
  slug: string;
  name: string;
  eventDate: string | null;
  clientNames: string | null;
  coverImage: { filePath: string } | null;
}

type Phase = 'idle' | 'uploading' | 'done';

export default function GuestUploadPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const fileRef = useRef<HTMLInputElement>(null);

  const [phase, setPhase] = useState<Phase>('idle');
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [uploadedTotal, setUploadedTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const { data: event, isLoading, error: loadError } = useQuery({
    queryKey: ['guestEvent', slug],
    queryFn: () => api<EventInfo>(`/api/public/events/${slug}`),
    staleTime: 300_000,
    retry: 1,
  });

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const images = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (!images.length) {
      setError('Odaberite fotografije (JPG, PNG, HEIC...)');
      return;
    }

    setPhase('uploading');
    setError(null);
    setProgress({ current: 0, total: images.length });

    try {
      // Kompresuj i šalji u serijama od 5 (backend prima ≤10 po zahtjevu)
      const BATCH = 5;
      let done = 0;
      for (let i = 0; i < images.length; i += BATCH) {
        const batch = images.slice(i, i + BATCH);
        const compressed = await Promise.all(
          batch.map((file) =>
            imageCompression(file, {
              maxWidthOrHeight: 2000,
              maxSizeMB: 2,
              useWebWorker: true,
              initialQuality: 0.85,
            }).catch(() => file) // ako kompresija zakaže, šalji original
          )
        );

        const form = new FormData();
        for (const [j, blob] of compressed.entries()) {
          form.append('images', blob, batch[j].name || 'photo.jpg');
        }

        const res = await fetch(`${API_URL}/api/public/events/${slug}/images`, {
          method: 'POST',
          body: form,
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `Greška (HTTP ${res.status})`);
        }

        done += batch.length;
        setProgress({ current: done, total: images.length });
      }

      setUploadedTotal((n) => n + images.length);
      setPhase('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload nije uspio, pokušajte ponovo');
      setPhase('idle');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-cream">
        <Loader2 className="h-7 w-7 animate-spin text-gold-dark" />
      </main>
    );
  }

  if (loadError || !event) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-cream px-6 text-center">
        <p className="font-display text-2xl font-bold">Event nije pronađen</p>
        <p className="text-sm text-ink/50">Provjerite da ste skenirali ispravan QR kod.</p>
      </main>
    );
  }

  return (
    <main className="relative flex min-h-screen flex-col items-center bg-cream px-5 py-10">
      {/* Cover pozadina */}
      {event.coverImage && (
        <div className="absolute inset-x-0 top-0 h-72 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl(event.coverImage.filePath)!}
            alt=""
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-ink/30 via-ink/10 to-cream" />
        </div>
      )}

      <div className="relative mt-32 w-full max-w-md">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="rounded-3xl border border-ink/8 bg-white/95 p-8 text-center shadow-lifted backdrop-blur"
        >
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gold/12">
            <Heart className="h-6 w-6 text-gold-dark" />
          </div>

          {event.clientNames && (
            <p className="font-display text-2xl font-bold">{event.clientNames}</p>
          )}
          <p className="mt-1 text-sm text-ink/50">{event.name}</p>
          {event.eventDate && (
            <p className="mt-0.5 text-xs uppercase tracking-[0.2em] text-gold-dark">
              {new Date(event.eventDate).toLocaleDateString('bs-BA', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </p>
          )}

          <div className="my-6 h-px bg-ink/8" />

          <AnimatePresence mode="wait">
            {phase === 'uploading' ? (
              <motion.div
                key="uploading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="py-4"
              >
                <Loader2 className="mx-auto h-8 w-8 animate-spin text-gold-dark" />
                <p className="mt-3 text-sm font-medium">Spremamo uspomene...</p>
                <div className="mx-auto mt-3 h-1.5 w-48 overflow-hidden rounded-full bg-ink/8">
                  <motion.div
                    className="h-full bg-gold"
                    animate={{
                      width: `${progress.total ? (progress.current / progress.total) * 100 : 5}%`,
                    }}
                    transition={{ duration: 0.4 }}
                  />
                </div>
                <p className="mt-2 text-xs text-ink/40">
                  {progress.current} / {progress.total}
                </p>
              </motion.div>
            ) : phase === 'done' ? (
              <motion.div
                key="done"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="py-2"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 18, delay: 0.1 }}
                >
                  <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
                </motion.div>
                <p className="mt-3 font-display text-xl font-bold">Hvala Vam! 💛</p>
                <p className="mt-1 text-sm text-ink/50">
                  {uploadedTotal} {uploadedTotal === 1 ? 'uspomena je sačuvana' : 'uspomene su sačuvane'}.
                </p>
                <button
                  onClick={() => fileRef.current?.click()}
                  className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-gold py-3 text-sm font-semibold text-gold-dark transition-colors hover:bg-gold/8"
                >
                  <ImagePlus className="h-4 w-4" />
                  Dodaj još slika
                </button>
              </motion.div>
            ) : (
              <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <p className="text-sm leading-relaxed text-ink/55">
                  Podijelite svoje fotografije s ove proslave — postaju dio zajedničke uspomene.
                </p>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => fileRef.current?.click()}
                  className="btn-glossy mt-5 flex w-full items-center justify-center gap-2.5 rounded-full bg-gold py-4 font-semibold text-ink shadow-soft transition-colors"
                >
                  <Camera className="h-5 w-5" />
                  Dodaj uspomenu
                </motion.button>
                <p className="mt-3 text-xs text-ink/35">
                  Možete odabrati više fotografija odjednom. Bez aplikacije, bez registracije.
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {error && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-500"
            >
              {error}
            </motion.p>
          )}

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-6 text-center"
        >
          <Link
            href={`/gallery/${slug}`}
            className="inline-flex items-center gap-1.5 text-sm text-ink/45 transition-colors hover:text-gold-dark"
          >
            <PartyPopper className="h-3.5 w-3.5" />
            Pogledaj galeriju
          </Link>
        </motion.div>

        <p className="mt-10 text-center text-xs text-ink/30">
          Special Day<span className="text-gold">.</span> — nezaboravni eventi
        </p>
      </div>
    </main>
  );
}
