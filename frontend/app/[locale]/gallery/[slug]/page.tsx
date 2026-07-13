'use client';

import { use, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'motion/react';
import {
  Loader2,
  Camera,
  Download,
  X,
  ChevronLeft,
  ChevronRight,
  ImagePlus,
} from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { imageUrl } from '@/lib/menuTypes';

interface GalleryImage {
  id: number;
  filePath: string;
  thumbPath: string;
  width: number;
  height: number;
  uploadedAt: string;
}

interface GalleryData {
  slug: string;
  name: string;
  eventDate: string | null;
  clientNames: string | null;
  images: GalleryImage[];
}

export default function GalleryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [lightbox, setLightbox] = useState<number | null>(null);

  const { data: gallery, isLoading, error } = useQuery({
    queryKey: ['gallery', slug],
    queryFn: () => api<GalleryData>(`/api/public/events/${slug}/gallery`),
    refetchInterval: 30_000, // nove slike pristižu tokom eventa
  });

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-ink">
        <Loader2 className="h-7 w-7 animate-spin text-gold" />
      </main>
    );
  }

  if (error || !gallery) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-ink px-6 text-center text-cream">
        <p className="font-display text-2xl font-bold">Galerija nije pronađena</p>
        <p className="text-sm text-cream/50">Provjerite link ili QR kod.</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-ink pb-16 text-cream">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-cream/8 bg-ink/90 px-5 py-4 backdrop-blur-lg">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div>
            <h1 className="font-display text-lg font-bold leading-tight">
              {gallery.clientNames || gallery.name}
            </h1>
            <p className="text-xs text-cream/45">
              {gallery.eventDate &&
                new Date(gallery.eventDate).toLocaleDateString('bs-BA', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              {gallery.eventDate && ' · '}
              {gallery.images.length} {gallery.images.length === 1 ? 'uspomena' : 'uspomena'}
            </p>
          </div>
          <Link
            href={`/g/${slug}`}
            className="btn-glossy flex items-center gap-2 rounded-full bg-gold px-4 py-2 text-xs font-semibold text-ink transition-colors"
          >
            <ImagePlus className="h-3.5 w-3.5" />
            Dodaj uspomenu
          </Link>
        </div>
      </header>

      {/* Masonry grid */}
      <div className="mx-auto max-w-5xl px-4 pt-6">
        {gallery.images.length === 0 ? (
          <div className="py-24 text-center">
            <Camera className="mx-auto mb-4 h-10 w-10 text-cream/15" />
            <p className="text-cream/40">Galerija je još prazna.</p>
            <p className="mt-1 text-sm text-cream/25">Budite prvi koji će dodati uspomenu!</p>
          </div>
        ) : (
          <div className="columns-2 gap-3 sm:columns-3 lg:columns-4">
            {gallery.images.map((image, index) => (
              <motion.div
                key={image.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.4 }}
                className="group relative mb-3 cursor-zoom-in overflow-hidden rounded-xl"
                onClick={() => setLightbox(index)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageUrl(image.thumbPath)!}
                  alt=""
                  loading="lazy"
                  style={{ aspectRatio: `${image.width} / ${image.height}` }}
                  className="w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink/40 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox */}
      <AnimatePresence>
        {lightbox !== null && gallery.images[lightbox] && (
          <Lightbox
            images={gallery.images}
            index={lightbox}
            onClose={() => setLightbox(null)}
            onNavigate={setLightbox}
          />
        )}
      </AnimatePresence>

      <p className="mt-12 text-center text-xs text-cream/25">
        Special Day<span className="text-gold">.</span> — nezaboravni eventi
      </p>
    </main>
  );
}

function Lightbox({
  images,
  index,
  onClose,
  onNavigate,
}: {
  images: GalleryImage[];
  index: number;
  onClose: () => void;
  onNavigate: (i: number) => void;
}) {
  const image = images[index];
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') onNavigate((index - 1 + images.length) % images.length);
      if (e.key === 'ArrowRight') onNavigate((index + 1) % images.length);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, images.length, onClose, onNavigate]);

  const download = async () => {
    setDownloading(true);
    try {
      const res = await fetch(imageUrl(image.filePath)!);
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `uspomena_${image.id}.webp`;
      a.click();
      URL.revokeObjectURL(a.href);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/95 p-4"
      onClick={onClose}
    >
      <div className="absolute right-4 top-4 flex gap-2">
        <button
          onClick={(e) => {
            e.stopPropagation();
            download();
          }}
          className="rounded-lg bg-cream/10 p-2.5 text-cream/70 backdrop-blur transition-colors hover:bg-cream/20 hover:text-cream"
          title="Preuzmi"
        >
          {downloading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5" />}
        </button>
        <button className="rounded-lg bg-cream/10 p-2.5 text-cream/70 backdrop-blur transition-colors hover:bg-cream/20 hover:text-cream">
          <X className="h-5 w-5" />
        </button>
      </div>

      <button
        onClick={(e) => {
          e.stopPropagation();
          onNavigate((index - 1 + images.length) % images.length);
        }}
        className="absolute left-4 rounded-full bg-cream/10 p-3 text-cream/70 backdrop-blur transition-colors hover:bg-cream/20 hover:text-cream"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>

      <motion.img
        key={image.id}
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        src={imageUrl(image.filePath)!}
        alt=""
        className="max-h-[88vh] max-w-[88vw] rounded-lg object-contain"
        onClick={(e) => e.stopPropagation()}
      />

      <button
        onClick={(e) => {
          e.stopPropagation();
          onNavigate((index + 1) % images.length);
        }}
        className="absolute right-4 rounded-full bg-cream/10 p-3 text-cream/70 backdrop-blur transition-colors hover:bg-cream/20 hover:text-cream"
      >
        <ChevronRight className="h-5 w-5" />
      </button>

      <p className="absolute bottom-4 text-xs text-cream/40">
        {index + 1} / {images.length}
      </p>
    </motion.div>
  );
}
