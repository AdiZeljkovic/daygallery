'use client';

import { use, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'motion/react';
import {
  Heart,
  MapPin,
  Send,
  Loader2,
  CheckCircle2,
  Minus,
  Plus,
  CalendarHeart,
  ChevronDown,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { imageUrl } from '@/lib/menuTypes';

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
  } | null;
  design: {
    sealInitials?: string;
    sealFont?: 'cinzel' | 'cormorant' | 'playfairSC';
  } | null;
  schedule: { time: string; title: string; location: string | null }[];
}

const SEAL_FONTS = {
  cinzel: 'font-cinzel',
  cormorant: 'font-cormorant',
  playfairSC: 'font-playfair-sc',
} as const;

/** Determinističke svjetlucave čestice raspoređene po ekranu (bez hydration mismatcha). */
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

function deriveInitials(hostNames: string) {
  return hostNames
    .split('&')
    .map((n) => n.trim()[0])
    .filter(Boolean)
    .join('');
}

export default function InvitePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [opened, setOpened] = useState(false);

  const { data: invite, isLoading, error } = useQuery({
    queryKey: ['invite', slug],
    queryFn: () => api<InviteView>(`/api/public/invites/${slug}`),
    staleTime: 300_000,
    retry: 1,
  });

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-cream">
        <Loader2 className="h-7 w-7 animate-spin text-gold-dark" />
      </main>
    );
  }

  if (error || !invite) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-cream px-6 text-center">
        <p className="font-display text-2xl font-bold">Pozivnica nije pronađena</p>
        <p className="text-sm text-ink/50">Provjerite link ili QR kod.</p>
      </main>
    );
  }

  const wd = invite.weddingDetails;
  const hasCover = !!invite.coverImagePath;
  const sealFontClass = SEAL_FONTS[invite.design?.sealFont ?? 'cinzel'];
  const sealInitials = invite.design?.sealInitials?.trim() || deriveInitials(invite.hostNames) || '♥';
  const names = invite.hostNames.split('&');

  return (
    <main className="min-h-screen bg-cream">
      <AnimatePresence>
        {!opened && (
          <CinematicIntro
            hostNames={invite.hostNames}
            initials={sealInitials}
            fontClass={sealFontClass}
            eyebrow={wd?.heroEyebrow}
            date={invite.date}
            coverImagePath={invite.coverImagePath}
            onOpen={() => setOpened(true)}
          />
        )}
      </AnimatePresence>

      {/* ===================== HERO ===================== */}
      <section className="relative flex min-h-[92vh] flex-col items-center justify-center overflow-hidden px-6 text-center">
        {hasCover ? (
          <>
            {/* Ken Burns cover */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <motion.img
              src={imageUrl(invite.coverImagePath)!}
              alt=""
              initial={{ scale: 1.14 }}
              animate={{ scale: 1 }}
              transition={{ duration: 9, ease: 'easeOut' }}
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-ink/60 via-ink/35 to-ink/75" />
            {/* vinjeta */}
            <div className="pointer-events-none absolute inset-0 [box-shadow:inset_0_0_180px_60px_rgba(12,11,9,0.55)]" />
          </>
        ) : (
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute left-1/2 top-1/3 h-[36rem] w-[36rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold/10 blur-3xl" />
          </div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={opened ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 1, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className={`relative ${hasCover ? 'text-cream' : 'text-ink'}`}
        >
          <motion.p
            initial={{ opacity: 0, letterSpacing: '0.5em' }}
            animate={opened ? { opacity: hasCover ? 0.85 : 0.6, letterSpacing: '0.35em' } : {}}
            transition={{ duration: 1.1, delay: 0.35 }}
            className="text-[11px] uppercase"
          >
            {wd?.heroEyebrow ?? 'Pozivamo vas na naš poseban dan'}
          </motion.p>

          <h1
            className={`mt-6 font-cormorant text-6xl font-bold leading-[1.02] md:text-8xl ${
              hasCover ? 'text-cream drop-shadow-[0_2px_18px_rgba(0,0,0,0.5)]' : 'text-foil'
            }`}
          >
            {names.map((name, i, arr) => (
              <span key={i}>
                {name.trim()}
                {i < arr.length - 1 && (
                  <span className="mx-3 align-baseline font-display text-gold">&amp;</span>
                )}
              </span>
            ))}
          </h1>

          {/* self-draw divider */}
          <motion.div
            initial={{ scaleX: 0 }}
            animate={opened ? { scaleX: 1 } : {}}
            transition={{ duration: 1, delay: 0.9, ease: 'easeInOut' }}
            className="mx-auto mt-7 h-px w-40 origin-center bg-gradient-to-r from-transparent via-gold to-transparent"
          />

          {invite.date && (
            <p className="mt-6 text-sm uppercase tracking-[0.28em] opacity-85">
              {new Date(invite.date).toLocaleDateString('bs-BA', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
              {invite.time && ` · ${invite.time}h`}
            </p>
          )}
          {invite.location && (
            <p className="mt-2 flex items-center justify-center gap-1.5 text-sm opacity-75">
              <MapPin className="h-3.5 w-3.5" /> {invite.location}
            </p>
          )}
        </motion.div>

        {/* scroll cue */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={opened ? { opacity: 1 } : {}}
          transition={{ delay: 1.4 }}
          className="absolute bottom-8"
        >
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className={`h-8 w-5 rounded-full border-2 ${hasCover ? 'border-cream/40' : 'border-ink/25'}`}
          >
            <motion.div
              animate={{ y: [4, 14, 4], opacity: [1, 0, 1] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className={`mx-auto mt-1 h-1.5 w-1 rounded-full ${hasCover ? 'bg-cream/60' : 'bg-ink/40'}`}
            />
          </motion.div>
        </motion.div>
      </section>

      {/* ===================== PORUKA ===================== */}
      {invite.message && (
        <Reveal className="mx-auto max-w-xl px-6 py-20 text-center">
          <Heart className="mx-auto mb-5 h-6 w-6 fill-gold/60 text-gold" />
          <p className="font-cormorant text-2xl leading-relaxed text-ink/80">{invite.message}</p>
        </Reveal>
      )}

      {/* ===================== ODBROJAVANJE ===================== */}
      {invite.date && (
        <Reveal className="px-6 pb-20">
          <Countdown date={invite.date} time={invite.time} sub={wd?.countdownSub} />
        </Reveal>
      )}

      {/* ===================== NAŠA PRIČA (wedding) ===================== */}
      {wd?.story && wd.story.length > 0 && (
        <section className="relative overflow-hidden bg-ink px-6 py-24 text-cream">
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            {SPARKLES.slice(0, 7).map((s, i) => (
              <span
                key={i}
                className="absolute rounded-full bg-gold-light shadow-[0_0_6px_rgba(232,205,111,0.8)]"
                style={{
                  top: s.top,
                  left: s.left,
                  width: s.size,
                  height: s.size,
                  ['--tw-op' as string]: s.op,
                  animation: `twinkle ${s.dur} ease-in-out ${s.delay} infinite`,
                }}
              />
            ))}
          </div>
          <Reveal className="relative mx-auto max-w-xl">
            <SectionTitle light overline="Naša priča" title="Kako je sve počelo" />
            <div className="relative mt-14 space-y-12 before:absolute before:inset-y-0 before:left-[7px] before:w-px before:bg-gold/30">
              {wd.story.map((chapter, i) => (
                <Reveal key={i} className="relative pl-10">
                  <span className="absolute left-0 top-1.5 h-[15px] w-[15px] rounded-full border-2 border-gold bg-ink" />
                  <p className="text-xs uppercase tracking-[0.25em] text-gold">{chapter.when}</p>
                  <h3 className="mt-1.5 font-display text-xl font-bold">{chapter.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-cream/60">{chapter.text}</p>
                </Reveal>
              ))}
            </div>
          </Reveal>
        </section>
      )}

      {/* ===================== PROGRAM DANA ===================== */}
      {invite.schedule.length > 0 && (
        <Reveal className="mx-auto max-w-xl px-6 py-20">
          <SectionTitle overline="Program" title="Raspored dana" />
          <div className="mt-12 space-y-6">
            {invite.schedule.map((item, i) => (
              <Reveal key={i} className="flex items-start gap-4">
                <span className="flex h-12 w-16 shrink-0 flex-col items-center justify-center rounded-xl bg-gold/12 font-display font-bold text-gold-dark">
                  {item.time}
                </span>
                <div className="pt-1">
                  <h3 className="font-semibold">{item.title}</h3>
                  {item.location && (
                    <p className="mt-0.5 flex items-center gap-1 text-sm text-ink/45">
                      <MapPin className="h-3 w-3" /> {item.location}
                    </p>
                  )}
                </div>
              </Reveal>
            ))}
          </div>
        </Reveal>
      )}

      {/* ===================== LOKACIJA (wedding) ===================== */}
      {wd?.venueName && (
        <Reveal className="mx-auto max-w-xl px-6 pb-20">
          <div className="rounded-3xl border border-gold/25 bg-white p-8 text-center shadow-soft">
            <MapPin className="mx-auto mb-3 h-6 w-6 text-gold-dark" />
            <h3 className="font-display text-2xl font-bold">{wd.venueName}</h3>
            {wd.venueAddress && <p className="mt-1 text-sm text-ink/50">{wd.venueAddress}</p>}
            {wd.venueMaps && (
              <a
                href={wd.venueMaps}
                target="_blank"
                rel="noreferrer"
                className="mt-5 inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-cream transition-colors hover:bg-ink-soft"
              >
                <MapPin className="h-4 w-4" /> Prikaži na mapi
              </a>
            )}
          </div>
        </Reveal>
      )}

      {/* ===================== RSVP ===================== */}
      <section className="bg-gradient-to-b from-cream to-cream-dark px-6 py-24">
        <Reveal className="mx-auto max-w-md">
          <SectionTitle overline="RSVP" title={wd?.rsvpSub ?? 'Molimo potvrdite dolazak'} />
          <RsvpForm slug={slug} />
        </Reveal>
      </section>

      <p className="bg-cream-dark pb-8 text-center text-xs text-ink/30">
        Special Day<span className="text-gold">.</span> — nezaboravni eventi
      </p>
    </main>
  );
}

// ================================================================
// Cinematic intro — moderan, "wow" reveal (bez koverte)
// ================================================================

function CinematicIntro({
  hostNames,
  initials,
  fontClass,
  eyebrow,
  date,
  coverImagePath,
  onOpen,
}: {
  hostNames: string;
  initials: string;
  fontClass: string;
  eyebrow?: string;
  date: string | null;
  coverImagePath: string | null;
  onOpen: () => void;
}) {
  const [leaving, setLeaving] = useState(false);
  const names = hostNames.split('&').map((n) => n.trim()).filter(Boolean);
  const cover = coverImagePath ? imageUrl(coverImagePath) : null;

  const handleOpen = () => {
    if (leaving) return;
    setLeaving(true);
    setTimeout(onOpen, 1100);
  };

  const ease = [0.16, 1, 0.3, 1] as const;

  return (
    <motion.div
      exit={{ opacity: 0, scale: 1.08, filter: 'blur(8px)', transition: { duration: 0.9, ease } }}
      className="fixed inset-0 z-50 flex cursor-pointer flex-col items-center justify-center overflow-hidden bg-[#080604] text-cream"
      onClick={handleOpen}
    >
      {/* Pozadina: cover full-bleed ili duboki gradient */}
      {cover ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <motion.img
            src={cover}
            alt=""
            initial={{ scale: 1.2 }}
            animate={{ scale: leaving ? 1.28 : 1.08 }}
            transition={{ duration: 12, ease: 'easeOut' }}
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/75 via-black/55 to-black/85" />
        </>
      ) : (
        <div className="absolute inset-0 [background:radial-gradient(circle_at_50%_38%,#241a0c,#0d0906_55%,#050403_100%)]" />
      )}

      {/* rotirajući zlatni conic glow */}
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 70, ease: 'linear' }}
        className="pointer-events-none absolute left-1/2 top-1/2 h-[64rem] w-[64rem] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-50 blur-2xl [background:conic-gradient(from_0deg,transparent,rgba(212,175,55,0.14),transparent_30%,transparent_55%,rgba(212,175,55,0.10),transparent_80%)]"
      />
      <div className="pointer-events-none absolute inset-0 [box-shadow:inset_0_0_340px_120px_rgba(0,0,0,0.7)]" />

      {/* čestice */}
      <div className="pointer-events-none absolute inset-0">
        {SPARKLES.map((s, i) => (
          <span
            key={i}
            className="absolute rounded-full bg-gold-light shadow-[0_0_8px_rgba(232,205,111,0.9)]"
            style={{
              top: s.top,
              left: s.left,
              width: s.size,
              height: s.size,
              ['--tw-op' as string]: s.op,
              animation: `twinkle ${s.dur} ease-in-out ${s.delay} infinite`,
            }}
          />
        ))}
      </div>

      {/* okvir */}
      <div className="pointer-events-none absolute inset-4 rounded-[1.75rem] border border-gold/15 sm:inset-8" />

      {/* Sadržaj */}
      <motion.div
        animate={leaving ? { y: -18, opacity: 0 } : {}}
        transition={{ duration: 0.8, ease }}
        className="relative flex flex-col items-center px-6 text-center"
      >
        {/* eyebrow */}
        <motion.p
          initial={{ opacity: 0, letterSpacing: '0.6em' }}
          animate={{ opacity: 0.7, letterSpacing: '0.45em' }}
          transition={{ delay: 0.3, duration: 1.1 }}
          className="text-[10px] uppercase text-gold-light"
        >
          {eyebrow ?? 'Pozivamo vas'}
        </motion.p>

        {/* Monogram koji se iscrtava */}
        <div className="relative mt-6 flex h-28 w-28 items-center justify-center sm:h-32 sm:w-32">
          <svg viewBox="0 0 120 120" className="absolute inset-0 h-full w-full -rotate-90">
            <defs>
              <linearGradient id="ring" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#e8cd6f" />
                <stop offset="50%" stopColor="#d4af37" />
                <stop offset="100%" stopColor="#a8871f" />
              </linearGradient>
            </defs>
            <motion.circle
              cx="60" cy="60" r="55" fill="none" stroke="url(#ring)" strokeWidth="1.3" strokeLinecap="round"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 1.5, ease: 'easeInOut', delay: 0.4 }}
            />
            <motion.circle
              cx="60" cy="60" r="48" fill="none" stroke="rgba(212,175,55,0.3)" strokeWidth="0.6"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1.7, ease: 'easeInOut', delay: 0.55 }}
            />
          </svg>
          <motion.span
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 1.15, duration: 0.7, ease }}
            className={`relative text-3xl text-gold-light sm:text-4xl ${fontClass}`}
          >
            {initials}
          </motion.span>
        </div>

        {/* Imena — mask reveal + foil */}
        <h1 className="mt-8 font-cormorant text-6xl font-semibold leading-[0.95] sm:text-8xl">
          {names.map((n, i) => (
            <span key={i}>
              <span className="block overflow-hidden py-0.5">
                <motion.span
                  initial={{ y: '115%' }}
                  animate={{ y: leaving ? '-115%' : 0 }}
                  transition={{ delay: leaving ? i * 0.06 : 1.2 + i * 0.22, duration: 0.95, ease }}
                  className="block text-foil"
                >
                  {n}
                </motion.span>
              </span>
              {i < names.length - 1 && (
                <motion.span
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 1.5, duration: 0.6 }}
                  className="my-1 block font-display text-2xl text-gold sm:text-3xl"
                >
                  &amp;
                </motion.span>
              )}
            </span>
          ))}
        </h1>

        {/* divider */}
        <motion.div
          initial={{ scaleX: 0, opacity: 0 }}
          animate={{ scaleX: 1, opacity: 1 }}
          transition={{ delay: 1.9, duration: 1, ease: 'easeInOut' }}
          className="mt-7 h-px w-44 origin-center bg-gradient-to-r from-transparent via-gold to-transparent"
        />

        {/* datum */}
        {date && (
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 0.85, y: 0 }}
            transition={{ delay: 2.05, duration: 0.9 }}
            className="mt-5 text-sm uppercase tracking-[0.3em] text-cream/85"
          >
            {new Date(date).toLocaleDateString('bs-BA', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </motion.p>
        )}

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 2.4, duration: 0.8 }}
          className="mt-12 flex flex-col items-center gap-3"
        >
          <motion.div
            animate={{ y: [0, 6, 0] }}
            transition={{ repeat: Infinity, duration: 2.2, ease: 'easeInOut' }}
            className="relative flex h-14 w-14 items-center justify-center rounded-full border border-gold/50"
          >
            <span className="absolute inset-0 rounded-full bg-gold/10 blur-md" />
            <ChevronDown className="relative h-5 w-5 text-gold-light" />
          </motion.div>
          <span className="text-[11px] uppercase tracking-[0.32em] text-cream/50">
            Dodirni za otvaranje
          </span>
        </motion.div>
      </motion.div>
    </motion.div>
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
  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff / 3_600_000) % 24);
  const minutes = Math.floor((diff / 60_000) % 60);
  const seconds = Math.floor((diff / 1000) % 60);

  const units = [
    { value: days, label: 'Dana' },
    { value: hours, label: 'Sati' },
    { value: minutes, label: 'Minuta' },
    { value: seconds, label: 'Sekundi' },
  ];

  return (
    <div className="mx-auto max-w-md text-center">
      <div className="grid grid-cols-4 gap-3">
        {units.map((unit) => (
          <div
            key={unit.label}
            className="rounded-2xl border border-gold/25 bg-white py-4 shadow-soft transition-shadow hover:shadow-lifted"
          >
            <motion.p
              key={unit.value}
              initial={{ opacity: 0.3, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="font-display text-3xl font-bold text-gold-dark"
            >
              {String(unit.value).padStart(2, '0')}
            </motion.p>
            <p className="mt-1 text-[10px] uppercase tracking-widest text-ink/40">{unit.label}</p>
          </div>
        ))}
      </div>
      {sub && <p className="mt-4 font-cormorant text-lg italic text-ink/50">{sub}</p>}
    </div>
  );
}

// ================================================================
// RSVP forma
// ================================================================

function RsvpForm({ slug }: { slug: string }) {
  const [name, setName] = useState('');
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
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          attending,
          plusOnes: attending ? plusOnes : 0,
          note: note.trim(),
        }),
      });
      setDone(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Slanje nije uspjelo, pokušajte ponovo');
      setSending(false);
    }
  };

  if (done) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        className="mt-8 rounded-3xl border border-gold/25 bg-white p-8 text-center shadow-soft"
      >
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 18, delay: 0.1 }}>
          <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
        </motion.div>
        <p className="mt-4 font-display text-xl font-bold">Hvala Vam!</p>
        <p className="mt-1 text-sm text-ink/50">
          {attending ? 'Radujemo se Vašem dolasku! 🎉' : 'Žao nam je što ne možete doći. 💛'}
        </p>
      </motion.div>
    );
  }

  const input = 'w-full rounded-xl border border-ink/12 bg-white px-4 py-3 text-sm outline-none transition-colors focus:border-gold';

  return (
    <div className="mt-8 space-y-3 rounded-3xl border border-ink/8 bg-white p-6 shadow-soft">
      <input placeholder="Vaše ime i prezime *" value={name} onChange={(e) => setName(e.target.value)} className={input} />
      <input placeholder="Telefon ili email (opcionalno)" value={phone} onChange={(e) => setPhone(e.target.value)} className={input} />

      <div className="grid grid-cols-2 gap-2">
        {[
          { value: true, label: 'Dolazim ✓' },
          { value: false, label: 'Ne dolazim' },
        ].map((option) => (
          <button
            key={String(option.value)}
            type="button"
            onClick={() => setAttending(option.value)}
            className={`rounded-xl border py-3 text-sm font-semibold transition-all ${
              attending === option.value
                ? option.value
                  ? 'border-gold bg-gold/10 text-gold-dark'
                  : 'border-ink/30 bg-ink/5 text-ink/70'
                : 'border-ink/10 text-ink/40 hover:border-ink/25'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <AnimatePresence>
        {attending && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="flex items-center justify-between rounded-xl border border-ink/10 px-4 py-3">
              <span className="text-sm text-ink/60">Broj pratnje (+)</span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setPlusOnes((n) => Math.max(0, n - 1))}
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-ink/5 text-ink/60 transition-colors hover:bg-gold/15 hover:text-gold-dark"
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <span className="w-6 text-center font-display text-lg font-bold">{plusOnes}</span>
                <button
                  type="button"
                  onClick={() => setPlusOnes((n) => Math.min(10, n + 1))}
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-ink/5 text-ink/60 transition-colors hover:bg-gold/15 hover:text-gold-dark"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <textarea placeholder="Poruka ili napomena (opcionalno)" value={note} onChange={(e) => setNote(e.target.value)} rows={2} className={`${input} resize-none`} />

      {error && <p className="text-sm text-red-500">{error}</p>}

      <motion.button
        whileTap={{ scale: 0.98 }}
        onClick={submit}
        disabled={!name.trim() || sending}
        className="btn-glossy flex w-full items-center justify-center gap-2 rounded-full bg-gold py-3.5 font-semibold text-ink transition-colors disabled:opacity-50"
      >
        {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        {sending ? 'Šaljemo...' : 'Pošalji odgovor'}
      </motion.button>
    </div>
  );
}

// ================================================================
// Pomoćne komponente
// ================================================================

function Reveal({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function SectionTitle({
  overline,
  title,
  light,
}: {
  overline: string;
  title: string;
  light?: boolean;
}) {
  return (
    <div className="text-center">
      <p className="text-xs uppercase tracking-[0.35em] text-gold-dark">{overline}</p>
      <h2 className={`mt-2 font-display text-3xl font-bold ${light ? 'text-cream' : 'text-ink'}`}>
        {title}
      </h2>
      <div className="mx-auto mt-4 flex items-center justify-center gap-2">
        <motion.span
          initial={{ scaleX: 0 }}
          whileInView={{ scaleX: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, ease: 'easeInOut' }}
          className="h-px w-10 origin-right bg-gold/50"
        />
        <CalendarHeart className="h-3.5 w-3.5 text-gold" />
        <motion.span
          initial={{ scaleX: 0 }}
          whileInView={{ scaleX: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, ease: 'easeInOut' }}
          className="h-px w-10 origin-left bg-gold/50"
        />
      </div>
    </div>
  );
}
