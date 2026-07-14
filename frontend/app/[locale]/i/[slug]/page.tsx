'use client';

import { use, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import {
  Heart,
  MapPin,
  Send,
  Loader2,
  CheckCircle2,
  Minus,
  Plus,
  Music2,
  VolumeX,
  CalendarPlus,
  X,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { imageUrl } from '@/lib/menuTypes';

// ================================================================
// Royal paleta (izolovano od brend tokena — samo pozivnica)
// ================================================================
const C = {
  bg: '#071c16',
  panel: '#0c2c22',
  gold: '#d4af37',
  goldLight: '#e8cd6f',
  ivory: '#f2e9d5',
};

interface InviteView {
  slug: string;
  variant: 'standard' | 'wedding';
  title: string;
  hostNames: string;
  date: string | null;
  time: string | null;
  location: string | null;
  message: string | null;
  coverImagePath: string | null;
  weddingDetails: {
    heroEyebrow?: string;
    countdownSub?: string;
    rsvpSub?: string;
    story?: { when: string; title: string; text: string }[];
    venueName?: string;
    venueAddress?: string;
    venueMaps?: string;
    bride?: { name?: string; parents?: string; note?: string };
    groom?: { name?: string; parents?: string; note?: string };
  } | null;
  design: {
    sealInitials?: string;
    sealFont?: 'cinzel' | 'cormorant' | 'playfairSC';
    theme?: string;
    musicTrack?: 'none' | 'royal-1' | 'royal-2' | 'royal-3';
  } | null;
  schedule: { time: string; title: string; location: string | null }[];
  gallery?: { id: number; filePath: string; thumbPath: string }[];
  wishes?: { id: number; name: string; message: string; createdAt: string }[];
}

const SEAL_FONTS = {
  cinzel: 'font-cinzel',
  cormorant: 'font-cormorant',
  playfairSC: 'font-playfair-sc',
} as const;

function deriveInitials(hostNames: string) {
  return hostNames.split('&').map((n) => n.trim()[0]).filter(Boolean).join('');
}

const MONTHS_BS = [
  'januar', 'februar', 'mart', 'april', 'maj', 'juni',
  'juli', 'august', 'septembar', 'oktobar', 'novembar', 'decembar',
];
function formatBsDate(iso: string, withWeekday = false) {
  const WD = ['nedjelja', 'ponedjeljak', 'utorak', 'srijeda', 'četvrtak', 'petak', 'subota'];
  const d = new Date(iso);
  const base = `${d.getDate()}. ${MONTHS_BS[d.getMonth()]} ${d.getFullYear()}.`;
  return withWeekday ? `${WD[d.getDay()]}, ${base}` : base;
}

function icsHref(invite: InviteView) {
  if (!invite.date) return null;
  const d = new Date(invite.date);
  if (invite.time) {
    const [h, m] = invite.time.split(':').map(Number);
    d.setHours(h || 0, m || 0, 0, 0);
  }
  const fmt = (x: Date) => x.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const end = new Date(d.getTime() + 3 * 3600 * 1000);
  const body = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'BEGIN:VEVENT',
    `DTSTART:${fmt(d)}`, `DTEND:${fmt(end)}`, `SUMMARY:${invite.title}`,
    invite.location ? `LOCATION:${invite.location}` : '',
    'END:VEVENT', 'END:VCALENDAR',
  ].filter(Boolean).join('\r\n');
  return 'data:text/calendar;charset=utf8,' + encodeURIComponent(body);
}

/** Determinističke svjetlucave čestice. */
const SPARKLES = Array.from({ length: 11 }, (_, i) => {
  const a = ((i * 9301 + 49297) % 233280) / 233280;
  const b = ((i * 4021 + 7919) % 100000) / 100000;
  return {
    top: `${(8 + a * 82).toFixed(1)}%`,
    left: `${(7 + b * 86).toFixed(1)}%`,
    size: a > 0.62 ? 3 : 2,
    delay: `${(b * 5).toFixed(2)}s`,
    dur: `${(3.2 + a * 3).toFixed(2)}s`,
    op: (0.4 + b * 0.4).toFixed(2),
  };
});

/** Determinističke latice ruža. */
const PETALS = Array.from({ length: 14 }, (_, i) => {
  const a = ((i * 7919 + 104729) % 100000) / 100000;
  const b = ((i * 6151 + 22307) % 100000) / 100000;
  return {
    left: `${(a * 100).toFixed(1)}%`,
    delay: `${(b * 12).toFixed(2)}s`,
    dur: `${(11 + a * 9).toFixed(2)}s`,
    size: 8 + Math.round(a * 8),
    x: `${(b * 120 - 60).toFixed(0)}px`,
    r: `${Math.round(160 + a * 200)}deg`,
    op: (0.3 + b * 0.35).toFixed(2),
  };
});

// ================================================================
// Stranica
// ================================================================
export default function InvitePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [opened, setOpened] = useState(false);
  const [guest, setGuest] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [musicOn, setMusicOn] = useState(false);
  const reduce = useReducedMotion();

  useEffect(() => {
    try {
      const to = new URLSearchParams(window.location.search).get('to');
      if (to) setGuest(to.trim().slice(0, 60));
    } catch {}
  }, []);

  const { data: invite, isLoading, error } = useQuery({
    queryKey: ['invite', slug],
    queryFn: () => api<InviteView>(`/api/public/invites/${slug}`),
    staleTime: 300_000,
    retry: 1,
  });

  const track =
    invite?.design?.musicTrack && invite.design.musicTrack !== 'none'
      ? invite.design.musicTrack
      : null;

  const startMusic = () => {
    const a = audioRef.current;
    if (!a) return;
    a.volume = 0.6;
    a.play().then(() => setMusicOn(true)).catch(() => {});
  };
  const toggleMusic = () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) a.play().then(() => setMusicOn(true)).catch(() => {});
    else {
      a.pause();
      setMusicOn(false);
    }
  };

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center" style={{ backgroundColor: C.bg }}>
        <Loader2 className="h-7 w-7 animate-spin" style={{ color: C.gold }} />
      </main>
    );
  }
  if (error || !invite) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center" style={{ backgroundColor: C.bg, color: C.ivory }}>
        <p className="font-cormorant text-3xl font-bold">Pozivnica nije pronađena</p>
        <p className="text-sm opacity-60">Provjerite link ili QR kod.</p>
      </main>
    );
  }

  const wd = invite.weddingDetails;
  const sealFontClass = SEAL_FONTS[invite.design?.sealFont ?? 'cinzel'];
  const sealInitials = invite.design?.sealInitials?.trim() || deriveInitials(invite.hostNames) || '♥';
  const names = invite.hostNames.split('&').map((n) => n.trim()).filter(Boolean);
  const ics = icsHref(invite);
  const couple = wd?.bride?.name || wd?.groom?.name ? wd : null;

  return (
    <main className="relative min-h-screen overflow-x-hidden font-sans" style={{ backgroundColor: C.bg, color: C.ivory }}>
      {track && <audio ref={audioRef} src={`/music/${track}.mp3`} loop preload="auto" />}

      <AnimatePresence>
        {!opened && (
          <RoyalEnvelope
            hostNames={invite.hostNames}
            initials={sealInitials}
            fontClass={sealFontClass}
            eyebrow={wd?.heroEyebrow}
            date={invite.date}
            guest={guest}
            reduce={!!reduce}
            onBegin={startMusic}
            onOpen={() => setOpened(true)}
          />
        )}
      </AnimatePresence>

      {/* Lebdeće latice preko cijele pozivnice */}
      {!reduce && opened && <Petals />}

      {/* ===================== HERO ===================== */}
      <section className="relative flex min-h-[94vh] flex-col items-center justify-center overflow-hidden px-6 text-center">
        {invite.coverImagePath ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <motion.img
              src={imageUrl(invite.coverImagePath)!}
              alt=""
              initial={{ scale: 1.18 }}
              animate={{ scale: 1 }}
              transition={{ duration: 12, ease: 'easeOut' }}
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0" style={{ background: `linear-gradient(to bottom, ${C.bg}cc, ${C.bg}88, ${C.bg}f2)` }} />
          </>
        ) : (
          <div className="pointer-events-none absolute inset-0" style={{ background: `radial-gradient(circle at 50% 35%, #10382a, ${C.bg} 60%)` }} />
        )}

        {/* zlatni ram */}
        <div className="pointer-events-none absolute inset-5 rounded-[1.5rem] border sm:inset-8" style={{ borderColor: `${C.gold}30` }} />

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={opened ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 1, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="relative"
        >
          <p className="text-[11px] uppercase tracking-[0.45em]" style={{ color: C.goldLight, opacity: 0.8 }}>
            {wd?.heroEyebrow ?? 'Pozivamo vas'}
          </p>

          <h1 className="mt-6 font-script text-7xl leading-[0.9] sm:text-8xl">
            {names.map((n, i) => (
              <span key={i} className="block">
                <span className="text-foil">{n}</span>
                {i < names.length - 1 && (
                  <span className="my-1 block font-cormorant text-3xl" style={{ color: C.gold }}>
                    &amp;
                  </span>
                )}
              </span>
            ))}
          </h1>

          <Ornament className="mt-8" />

          {invite.date && (
            <p className="mt-6 font-cormorant text-lg uppercase tracking-[0.28em]" style={{ opacity: 0.9 }}>
              {formatBsDate(invite.date, true)}
              {invite.time && ` · ${invite.time}h`}
            </p>
          )}
          {invite.location && (
            <p className="mt-2 flex items-center justify-center gap-1.5 text-sm opacity-70">
              <MapPin className="h-3.5 w-3.5" /> {invite.location}
            </p>
          )}
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={opened ? { opacity: 1 } : {}} transition={{ delay: 1.4 }} className="absolute bottom-8">
          <motion.div animate={{ y: [0, 8, 0] }} transition={{ repeat: Infinity, duration: 2 }} className="h-8 w-5 rounded-full border-2" style={{ borderColor: `${C.gold}66` }}>
            <motion.div animate={{ y: [4, 14, 4], opacity: [1, 0, 1] }} transition={{ repeat: Infinity, duration: 2 }} className="mx-auto mt-1 h-1.5 w-1 rounded-full" style={{ backgroundColor: C.goldLight }} />
          </motion.div>
        </motion.div>
      </section>

      {/* ===================== PORUKA ===================== */}
      {invite.message && (
        <Reveal className="mx-auto max-w-xl px-6 py-20 text-center">
          <Heart className="mx-auto mb-5 h-6 w-6" style={{ color: C.gold, fill: `${C.gold}77` }} />
          <p className="font-cormorant text-2xl italic leading-relaxed" style={{ opacity: 0.85 }}>
            {invite.message}
          </p>
        </Reveal>
      )}

      {/* ===================== ODBROJAVANJE ===================== */}
      {invite.date && (
        <Reveal className="px-6 pb-6">
          <SectionTitle overline="Odbrojavamo" title="Do velikog dana" />
          <Countdown date={invite.date} time={invite.time} sub={wd?.countdownSub} />
          {ics && (
            <div className="mt-8 text-center">
              <a href={ics} download="pozivnica.ics" className="inline-flex items-center gap-2 rounded-full border px-5 py-2.5 text-sm font-medium transition-colors" style={{ borderColor: `${C.gold}55`, color: C.goldLight }}>
                <CalendarPlus className="h-4 w-4" /> Dodaj u kalendar
              </a>
            </div>
          )}
        </Reveal>
      )}

      {/* ===================== PAR ===================== */}
      {couple && (
        <Reveal className="mx-auto max-w-3xl px-6 py-16">
          <SectionTitle overline="Mladenci" title="Sretni par" />
          <div className="mt-12 grid gap-6 sm:grid-cols-2">
            {[couple.bride, couple.groom].filter((p) => p?.name).map((p, i) => (
              <div key={i} className="rounded-2xl border p-6 text-center" style={{ borderColor: `${C.gold}25`, backgroundColor: 'rgba(255,255,255,0.03)' }}>
                <p className="font-script text-4xl" style={{ color: C.goldLight }}>{p!.name}</p>
                {p!.parents && <p className="mt-2 text-xs uppercase tracking-widest opacity-55">{p!.parents}</p>}
                {p!.note && <p className="mt-3 font-cormorant text-base italic opacity-75">{p!.note}</p>}
              </div>
            ))}
          </div>
        </Reveal>
      )}

      {/* ===================== NAŠA PRIČA ===================== */}
      {wd?.story && wd.story.length > 0 && (
        <Reveal className="mx-auto max-w-xl px-6 py-16">
          <SectionTitle overline="Naša priča" title="Kako je sve počelo" />
          <div className="relative mt-14 space-y-12 before:absolute before:inset-y-0 before:left-[7px] before:w-px" style={{ ['--tw' as string]: '' }}>
            <span className="absolute inset-y-0 left-[7px] w-px" style={{ backgroundColor: `${C.gold}44` }} />
            {wd.story.map((chapter, i) => (
              <Reveal key={i} className="relative pl-10">
                <span className="absolute left-0 top-1.5 h-[15px] w-[15px] rounded-full border-2" style={{ borderColor: C.gold, backgroundColor: C.bg }} />
                <p className="text-xs uppercase tracking-[0.25em]" style={{ color: C.goldLight }}>{chapter.when}</p>
                <h3 className="mt-1.5 font-cormorant text-2xl font-bold">{chapter.title}</h3>
                <p className="mt-2 text-sm leading-relaxed opacity-65">{chapter.text}</p>
              </Reveal>
            ))}
          </div>
        </Reveal>
      )}

      {/* ===================== GALERIJA ===================== */}
      {invite.gallery && invite.gallery.length > 0 && (
        <Reveal className="mx-auto max-w-4xl px-6 py-16">
          <SectionTitle overline="Galerija" title="Naši trenuci" />
          <Gallery images={invite.gallery} />
        </Reveal>
      )}

      {/* ===================== RASPORED ===================== */}
      {invite.schedule.length > 0 && (
        <Reveal className="mx-auto max-w-xl px-6 py-16">
          <SectionTitle overline="Program" title="Raspored dana" />
          <div className="mt-12 space-y-6">
            {invite.schedule.map((item, i) => (
              <Reveal key={i} className="flex items-start gap-4">
                <span className="flex h-12 w-16 shrink-0 items-center justify-center rounded-xl font-cormorant text-lg font-bold" style={{ backgroundColor: `${C.gold}18`, color: C.goldLight }}>
                  {item.time}
                </span>
                <div className="pt-1">
                  <h3 className="font-semibold">{item.title}</h3>
                  {item.location && (
                    <p className="mt-0.5 flex items-center gap-1 text-sm opacity-55">
                      <MapPin className="h-3 w-3" /> {item.location}
                    </p>
                  )}
                </div>
              </Reveal>
            ))}
          </div>
        </Reveal>
      )}

      {/* ===================== LOKACIJA ===================== */}
      {wd?.venueName && (
        <Reveal className="mx-auto max-w-xl px-6 pb-16">
          <div className="rounded-3xl border p-8 text-center" style={{ borderColor: `${C.gold}30`, backgroundColor: 'rgba(255,255,255,0.03)' }}>
            <MapPin className="mx-auto mb-3 h-6 w-6" style={{ color: C.goldLight }} />
            <h3 className="font-cormorant text-2xl font-bold">{wd.venueName}</h3>
            {wd.venueAddress && <p className="mt-1 text-sm opacity-60">{wd.venueAddress}</p>}
            {wd.venueMaps && (
              <a href={wd.venueMaps} target="_blank" rel="noreferrer" className="mt-5 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium" style={{ backgroundColor: C.gold, color: '#1a1408' }}>
                <MapPin className="h-4 w-4" /> Prikaži na mapi
              </a>
            )}
          </div>
        </Reveal>
      )}

      {/* ===================== RSVP ===================== */}
      <section className="px-6 py-20">
        <Reveal className="mx-auto max-w-md">
          <SectionTitle overline="RSVP" title={wd?.rsvpSub ?? 'Molimo potvrdite dolazak'} />
          <RsvpForm slug={slug} guest={guest} />
        </Reveal>
      </section>

      {/* ===================== ŽELJE ===================== */}
      <section className="px-6 py-20">
        <Reveal className="mx-auto max-w-xl">
          <SectionTitle overline="Knjiga želja" title="Ostavite čestitku" />
          <Wishes slug={slug} initial={invite.wishes ?? []} guest={guest} />
        </Reveal>
      </section>

      {/* footer */}
      <footer className="px-6 pb-12 text-center">
        <Ornament className="mb-5" />
        <p className={`text-4xl ${sealFontClass}`} style={{ color: C.goldLight }}>{sealInitials}</p>
        <p className="mt-3 text-[11px] uppercase tracking-[0.3em] opacity-40">
          Special Day — nezaboravni trenuci
        </p>
      </footer>

      {/* Plutajuće dugme za muziku */}
      {track && opened && (
        <button
          onClick={toggleMusic}
          aria-label={musicOn ? 'Utišaj muziku' : 'Pusti muziku'}
          className="fixed bottom-5 right-5 z-40 flex h-12 w-12 items-center justify-center rounded-full border shadow-lifted backdrop-blur"
          style={{ borderColor: `${C.gold}55`, backgroundColor: `${C.panel}dd`, color: C.goldLight }}
        >
          {musicOn ? <Music2 className="h-5 w-5 animate-spin-slow" /> : <VolumeX className="h-5 w-5" />}
        </button>
      )}
    </main>
  );
}

// ================================================================
// Latice ruža
// ================================================================
function Petals() {
  return (
    <div className="pointer-events-none fixed inset-0 z-[5] overflow-hidden">
      {PETALS.map((p, i) => (
        <span
          key={i}
          className="absolute top-0"
          style={{
            left: p.left,
            width: p.size,
            height: p.size * 1.3,
            borderRadius: '50% 0 50% 50%',
            background: 'linear-gradient(135deg, rgba(245,236,220,0.9), rgba(226,180,170,0.7))',
            ['--petal-x' as string]: p.x,
            ['--petal-r' as string]: p.r,
            ['--petal-op' as string]: p.op,
            animation: `petal-fall ${p.dur} linear ${p.delay} infinite`,
          }}
        />
      ))}
    </div>
  );
}

// ================================================================
// Royal koverta — opener
// ================================================================
function RoyalEnvelope({
  hostNames,
  initials,
  fontClass,
  eyebrow,
  date,
  guest,
  reduce,
  onBegin,
  onOpen,
}: {
  hostNames: string;
  initials: string;
  fontClass: string;
  eyebrow?: string;
  date: string | null;
  guest: string | null;
  reduce: boolean;
  onBegin: () => void;
  onOpen: () => void;
}) {
  const [opening, setOpening] = useState(false);
  const ease = [0.16, 1, 0.3, 1] as const;

  const handleOpen = () => {
    if (opening) return;
    onBegin(); // pokreni muziku sinhrono (autoplay policy)
    setOpening(true);
    setTimeout(onOpen, 1900);
  };

  return (
    <motion.div
      exit={{ opacity: 0, scale: 1.05, filter: 'blur(6px)', transition: { duration: 0.8, ease } }}
      className="fixed inset-0 z-50 flex cursor-pointer flex-col items-center justify-center overflow-hidden"
      style={{ backgroundColor: '#04120d', color: C.ivory }}
      onClick={handleOpen}
    >
      <div className="absolute inset-0" style={{ background: `radial-gradient(circle at 50% 42%, #103a2b, #061a13 55%, #030b08 100%)` }} />
      {!reduce && (
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 70, ease: 'linear' }}
          className="pointer-events-none absolute left-1/2 top-1/2 h-[64rem] w-[64rem] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-50 blur-2xl"
          style={{ background: `conic-gradient(from 0deg, transparent, ${C.gold}28, transparent 30%, transparent 55%, ${C.gold}1c, transparent 80%)` }}
        />
      )}
      <div className="pointer-events-none absolute inset-0" style={{ boxShadow: 'inset 0 0 340px 120px rgba(0,0,0,0.72)' }} />
      <div className="pointer-events-none absolute inset-0">
        {SPARKLES.map((s, i) => (
          <span key={i} className="absolute rounded-full" style={{ top: s.top, left: s.left, width: s.size, height: s.size, backgroundColor: C.goldLight, boxShadow: `0 0 8px ${C.goldLight}`, ['--tw-op' as string]: s.op, animation: `twinkle ${s.dur} ease-in-out ${s.delay} infinite` }} />
        ))}
      </div>
      <div className="pointer-events-none absolute inset-4 rounded-[1.75rem] border sm:inset-8" style={{ borderColor: `${C.gold}22` }} />

      {/* pozdrav gostu */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: opening ? 0 : 1, y: 0 }}
        transition={{ delay: 0.4, duration: 1 }}
        className="relative mb-8 text-center"
      >
        <p className="text-[10px] uppercase tracking-[0.5em]" style={{ color: C.goldLight, opacity: 0.7 }}>
          {eyebrow ?? 'Pozivnica'}
        </p>
        {guest && (
          <p className="mt-3 font-script text-3xl" style={{ color: C.goldLight }}>
            Za {guest}
          </p>
        )}
      </motion.div>

      {/* KOVERTA */}
      <motion.div
        initial={{ opacity: 0, y: 46, scale: 0.87 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 1.1, ease }}
        className="relative w-[22rem] sm:w-[32rem]"
        style={{ perspective: 1600 }}
      >
        <motion.div
          animate={opening ? { y: -14, scale: 1.02 } : reduce ? {} : { y: [0, -8, 0] }}
          transition={opening ? { duration: 0.7, ease } : { repeat: Infinity, duration: 6, ease: 'easeInOut' }}
          className="relative"
          style={{ aspectRatio: '3/2', transformStyle: 'preserve-3d', boxShadow: '0 60px 120px -30px rgba(0,0,0,0.85), 0 16px 40px -12px rgba(0,0,0,0.6)' }}
        >
          <div className="absolute inset-0 overflow-hidden rounded-2xl">
            <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg,#0f4132 0%,#0b3226 52%,#082a20 100%)' }} />
            <div className="absolute inset-4 rounded-lg border sm:inset-6" style={{ borderColor: `${C.gold}3a` }} />
            <div className="absolute inset-0" style={{ background: `linear-gradient(126deg, transparent 49.6%, rgba(0,0,0,0.18) 50%, transparent 50.4%), linear-gradient(234deg, transparent 49.6%, rgba(0,0,0,0.18) 50%, transparent 50.4%)` }} />

            {/* pismo */}
            <motion.div
              initial={{ y: 0, opacity: 0 }}
              animate={opening ? { y: '-64%', opacity: 1, scale: 1.02 } : {}}
              transition={{ duration: 1, delay: 0.7, ease }}
              className="absolute inset-x-8 top-5 bottom-5 flex flex-col items-center justify-center rounded-md px-4 text-center"
              style={{ background: '#f7f0e0', color: '#0c2c22', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}
            >
              <p className="text-[8px] uppercase tracking-[0.4em]" style={{ color: '#a8871f' }}>Pozivnica</p>
              <p className="mt-2 font-script text-4xl" style={{ color: '#0e3a2c' }}>
                {hostNames.split('&').map((n, i, a) => (
                  <span key={i}>{n.trim()}{i < a.length - 1 && <span style={{ color: C.gold }}> & </span>}</span>
                ))}
              </p>
              <div className="mx-auto my-2 h-px w-12" style={{ backgroundColor: `${C.gold}88` }} />
              {date && <p className="text-[10px] uppercase tracking-[0.28em] opacity-60">{formatBsDate(date)}</p>}
            </motion.div>

            {/* preklop */}
            <motion.div
              animate={opening ? { rotateX: -178 } : {}}
              transition={{ duration: 1.1, ease: 'easeInOut' }}
              style={{ transformOrigin: 'top', transformStyle: 'preserve-3d' }}
              className="absolute inset-x-0 top-0 z-10 h-1/2"
            >
              <div className="h-full w-full" style={{ clipPath: 'polygon(0 0, 100% 0, 50% 100%)', background: 'linear-gradient(to bottom,#125140,#0d3d2f)', boxShadow: 'inset 0 -3px 8px rgba(0,0,0,0.25)' }} />
            </motion.div>

            {opening && (
              <motion.div initial={{ x: '-130%' }} animate={{ x: '130%' }} transition={{ duration: 1.2, delay: 0.6, ease: 'easeInOut' }} className="absolute inset-y-0 z-20 w-1/3 -skew-x-12" style={{ background: 'linear-gradient(105deg, transparent 15%, rgba(255,255,255,0.35) 50%, transparent 85%)' }} />
            )}
          </div>

          <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset" style={{ ['--tw-ring-color' as string]: `${C.gold}40` }} />

          {/* wax pečat */}
          <motion.div
            animate={opening ? { scale: 0.35, y: -34, opacity: 0, transition: { duration: 0.55, ease: 'easeIn' } } : reduce ? {} : { scale: [1, 1.045, 1], transition: { repeat: Infinity, duration: 2.8, ease: 'easeInOut' } }}
            whileHover={opening ? undefined : { scale: 1.06 }}
            whileTap={opening ? undefined : { scale: 0.93 }}
            className="absolute left-1/2 top-1/2 z-30 h-[6.5rem] w-[6.5rem] -translate-x-1/2 -translate-y-1/2 sm:h-28 sm:w-28"
          >
            <div className="absolute inset-0 rounded-full" style={{ boxShadow: '0 16px 32px -8px rgba(120,80,10,0.7)' }} />
            <div className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-full" style={{ background: 'radial-gradient(circle at 34% 28%, #f6e39a 0%, #dcb948 34%, #b6902a 70%, #8a6b18 100%)' }}>
              <div className="absolute inset-[10px] rounded-full" style={{ boxShadow: 'inset 0 2px 4px rgba(255,247,214,0.6), inset 0 -4px 6px rgba(90,66,10,0.6)' }} />
              <div className="absolute inset-[10px] rounded-full border" style={{ borderColor: 'rgba(122,95,20,0.4)' }} />
              <div className="pointer-events-none absolute inset-0 rounded-full" style={{ background: 'radial-gradient(circle at 32% 26%, rgba(255,255,255,0.65), transparent 42%)' }} />
              {!opening && !reduce && (
                <motion.div initial={{ x: '-120%' }} animate={{ x: '120%' }} transition={{ repeat: Infinity, duration: 3.4, ease: 'easeInOut', repeatDelay: 1.6 }} className="absolute inset-y-0 w-1/2 -skew-x-12 opacity-70" style={{ background: 'linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.55) 50%, transparent 70%)' }} />
              )}
              <span className={`relative text-[1.9rem] leading-none ${fontClass}`} style={{ color: '#5c4713', textShadow: '0 1px 0 rgba(255,247,220,0.5)' }}>{initials}</span>
            </div>
          </motion.div>
        </motion.div>
      </motion.div>

      <motion.p initial={{ opacity: 0 }} animate={{ opacity: opening ? 0 : 1 }} transition={{ delay: 1, duration: 0.6 }} className="relative mt-14 flex items-center gap-3 text-[11px] uppercase tracking-[0.32em]" style={{ color: `${C.ivory}77` }}>
        <span className="h-px w-6" style={{ backgroundColor: `${C.gold}66` }} />
        Dodirnite pečat da otvorite
        <span className="h-px w-6" style={{ backgroundColor: `${C.gold}66` }} />
      </motion.p>
    </motion.div>
  );
}

// ================================================================
// Galerija + lightbox
// ================================================================
function Gallery({ images }: { images: { id: number; filePath: string; thumbPath: string }[] }) {
  const [active, setActive] = useState<number | null>(null);
  return (
    <>
      <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {images.map((img, i) => (
          <motion.button
            key={img.id}
            initial={{ opacity: 0, scale: 0.94 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: Math.min(i * 0.05, 0.5) }}
            onClick={() => setActive(i)}
            className="group relative aspect-square overflow-hidden rounded-xl border"
            style={{ borderColor: `${C.gold}25` }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl(img.thumbPath)!} alt="" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" />
          </motion.button>
        ))}
      </div>
      <AnimatePresence>
        {active !== null && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4" onClick={() => setActive(null)}>
            <button className="absolute right-5 top-5 text-white/70 hover:text-white" onClick={() => setActive(null)}>
              <X className="h-6 w-6" />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <motion.img initial={{ scale: 0.92 }} animate={{ scale: 1 }} src={imageUrl(images[active].filePath)!} alt="" className="max-h-[85vh] max-w-full rounded-lg object-contain" onClick={(e) => e.stopPropagation()} />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// ================================================================
// Knjiga želja (guestbook)
// ================================================================
function Wishes({
  slug,
  initial,
  guest,
}: {
  slug: string;
  initial: { id: number; name: string; message: string; createdAt: string }[];
  guest: string | null;
}) {
  const [list, setList] = useState(initial);
  const [name, setName] = useState(guest ?? '');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!name.trim() || !message.trim()) return;
    setSending(true);
    setError(null);
    try {
      const wish = await api<{ id: number; name: string; message: string; createdAt: string }>(
        `/api/public/invites/${slug}/wish`,
        { method: 'POST', body: JSON.stringify({ name: name.trim(), message: message.trim() }) }
      );
      setList((l) => [wish, ...l]);
      setMessage('');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Slanje nije uspjelo');
    } finally {
      setSending(false);
    }
  };

  const inputStyle = { borderColor: `${C.gold}30`, backgroundColor: 'rgba(255,255,255,0.04)', color: C.ivory } as const;
  const inputCls = 'w-full rounded-xl border px-4 py-3 text-sm outline-none transition-colors placeholder:opacity-40 focus:border-[#d4af37]';

  return (
    <div className="mt-10">
      <div className="space-y-3 rounded-3xl border p-6" style={{ borderColor: `${C.gold}25`, backgroundColor: 'rgba(255,255,255,0.03)' }}>
        <input placeholder="Vaše ime *" value={name} onChange={(e) => setName(e.target.value)} className={inputCls} style={inputStyle} />
        <textarea placeholder="Vaša čestitka / želja *" value={message} onChange={(e) => setMessage(e.target.value)} rows={3} className={`${inputCls} resize-none`} style={inputStyle} />
        {error && <p className="text-sm text-red-400">{error}</p>}
        <motion.button whileTap={{ scale: 0.98 }} onClick={submit} disabled={!name.trim() || !message.trim() || sending} className="btn-glossy flex w-full items-center justify-center gap-2 rounded-full py-3 font-semibold disabled:opacity-50" style={{ backgroundColor: C.gold, color: '#1a1408' }}>
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Pošalji čestitku
        </motion.button>
      </div>

      {list.length > 0 && (
        <div className="mt-6 space-y-3">
          <AnimatePresence initial={false}>
            {list.map((w) => (
              <motion.div key={w.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border p-4" style={{ borderColor: `${C.gold}20`, backgroundColor: 'rgba(255,255,255,0.02)' }}>
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-cormorant text-sm font-bold" style={{ backgroundColor: `${C.gold}20`, color: C.goldLight }}>
                    {w.name[0]?.toUpperCase()}
                  </span>
                  <p className="font-cormorant text-lg font-bold">{w.name}</p>
                </div>
                <p className="mt-2 text-sm leading-relaxed opacity-75">{w.message}</p>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

// ================================================================
// Countdown
// ================================================================
function Countdown({ date, time, sub }: { date: string; time: string | null; sub?: string }) {
  const target = useMemo(() => {
    const d = new Date(date);
    if (time) {
      const [h, m] = time.split(':').map(Number);
      d.setHours(h || 0, m || 0, 0, 0);
    }
    return d.getTime();
  }, [date, time]);

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const diff = Math.max(0, target - now);
  const units = [
    { value: Math.floor(diff / 86_400_000), label: 'Dana' },
    { value: Math.floor((diff / 3_600_000) % 24), label: 'Sati' },
    { value: Math.floor((diff / 60_000) % 60), label: 'Minuta' },
    { value: Math.floor((diff / 1000) % 60), label: 'Sekundi' },
  ];

  return (
    <div className="mx-auto mt-10 max-w-md text-center">
      <div className="grid grid-cols-4 gap-3">
        {units.map((u) => (
          <div key={u.label} className="rounded-2xl border py-4" style={{ borderColor: `${C.gold}30`, backgroundColor: 'rgba(255,255,255,0.03)' }}>
            <motion.p key={u.value} initial={{ opacity: 0.3, y: -8 }} animate={{ opacity: 1, y: 0 }} className="font-cormorant text-3xl font-bold" style={{ color: C.goldLight }}>
              {String(u.value).padStart(2, '0')}
            </motion.p>
            <p className="mt-1 text-[10px] uppercase tracking-widest opacity-45">{u.label}</p>
          </div>
        ))}
      </div>
      {sub && <p className="mt-4 font-cormorant text-lg italic opacity-55">{sub}</p>}
    </div>
  );
}

// ================================================================
// RSVP
// ================================================================
function RsvpForm({ slug, guest }: { slug: string; guest: string | null }) {
  const [name, setName] = useState(guest ?? '');
  const [phone, setPhone] = useState('');
  const [attending, setAttending] = useState(true);
  const [plusOnes, setPlusOnes] = useState(0);
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setSending(true);
    setError(null);
    try {
      await api(`/api/public/invites/${slug}/rsvp`, {
        method: 'POST',
        body: JSON.stringify({ name: name.trim(), phone: phone.trim(), attending, plusOnes: attending ? plusOnes : 0, note: note.trim() }),
      });
      setDone(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Slanje nije uspjelo, pokušajte ponovo');
      setSending(false);
    }
  };

  if (done) {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} className="mt-8 rounded-3xl border p-8 text-center" style={{ borderColor: `${C.gold}30`, backgroundColor: 'rgba(255,255,255,0.03)' }}>
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 18, delay: 0.1 }}>
          <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-400" />
        </motion.div>
        <p className="mt-4 font-cormorant text-2xl font-bold">Hvala Vam!</p>
        <p className="mt-1 text-sm opacity-60">{attending ? 'Radujemo se Vašem dolasku! 🎉' : 'Žao nam je što ne možete doći. 💛'}</p>
      </motion.div>
    );
  }

  const inputStyle = { borderColor: `${C.gold}30`, backgroundColor: 'rgba(255,255,255,0.04)', color: C.ivory } as const;
  const inputCls = 'w-full rounded-xl border px-4 py-3 text-sm outline-none transition-colors placeholder:opacity-40 focus:border-[#d4af37]';

  return (
    <div className="mt-8 space-y-3 rounded-3xl border p-6" style={{ borderColor: `${C.gold}25`, backgroundColor: 'rgba(255,255,255,0.03)' }}>
      <input placeholder="Vaše ime i prezime *" value={name} onChange={(e) => setName(e.target.value)} className={inputCls} style={inputStyle} />
      <input placeholder="Telefon ili email (opcionalno)" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} style={inputStyle} />

      <div className="grid grid-cols-2 gap-2">
        {[{ value: true, label: 'Dolazim ✓' }, { value: false, label: 'Ne dolazim' }].map((o) => (
          <button key={String(o.value)} type="button" onClick={() => setAttending(o.value)} className="rounded-xl border py-3 text-sm font-semibold transition-all" style={attending === o.value ? { borderColor: C.gold, backgroundColor: `${C.gold}18`, color: C.goldLight } : { borderColor: `${C.gold}20`, color: `${C.ivory}88` }}>
            {o.label}
          </button>
        ))}
      </div>

      <AnimatePresence>
        {attending && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="flex items-center justify-between rounded-xl border px-4 py-3" style={{ borderColor: `${C.gold}20` }}>
              <span className="text-sm opacity-70">Broj pratnje (+)</span>
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => setPlusOnes((n) => Math.max(0, n - 1))} className="flex h-7 w-7 items-center justify-center rounded-full" style={{ backgroundColor: `${C.gold}18`, color: C.goldLight }}><Minus className="h-3.5 w-3.5" /></button>
                <span className="w-6 text-center font-cormorant text-lg font-bold">{plusOnes}</span>
                <button type="button" onClick={() => setPlusOnes((n) => Math.min(10, n + 1))} className="flex h-7 w-7 items-center justify-center rounded-full" style={{ backgroundColor: `${C.gold}18`, color: C.goldLight }}><Plus className="h-3.5 w-3.5" /></button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <textarea placeholder="Poruka ili napomena (opcionalno)" value={note} onChange={(e) => setNote(e.target.value)} rows={2} className={`${inputCls} resize-none`} style={inputStyle} />
      {error && <p className="text-sm text-red-400">{error}</p>}

      <motion.button whileTap={{ scale: 0.98 }} onClick={submit} disabled={!name.trim() || sending} className="btn-glossy flex w-full items-center justify-center gap-2 rounded-full py-3.5 font-semibold disabled:opacity-50" style={{ backgroundColor: C.gold, color: '#1a1408' }}>
        {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        {sending ? 'Šaljemo...' : 'Pošalji odgovor'}
      </motion.button>
    </div>
  );
}

// ================================================================
// Pomoćne
// ================================================================
function Reveal({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-60px' }} transition={{ duration: 0.6, ease: 'easeOut' }} className={className}>
      {children}
    </motion.div>
  );
}

function Ornament({ className }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center gap-3 ${className ?? ''}`}>
      <motion.span initial={{ scaleX: 0 }} whileInView={{ scaleX: 1 }} viewport={{ once: true }} transition={{ duration: 0.7 }} className="h-px w-12 origin-right" style={{ background: `linear-gradient(to right, transparent, ${C.gold})` }} />
      <span style={{ color: C.gold }}>&#10086;</span>
      <motion.span initial={{ scaleX: 0 }} whileInView={{ scaleX: 1 }} viewport={{ once: true }} transition={{ duration: 0.7 }} className="h-px w-12 origin-left" style={{ background: `linear-gradient(to left, transparent, ${C.gold})` }} />
    </div>
  );
}

function SectionTitle({ overline, title }: { overline: string; title: string }) {
  return (
    <div className="text-center">
      <p className="text-xs uppercase tracking-[0.4em]" style={{ color: C.goldLight }}>{overline}</p>
      <h2 className="mt-2 font-cormorant text-3xl font-bold sm:text-4xl">{title}</h2>
      <Ornament className="mt-4" />
    </div>
  );
}
