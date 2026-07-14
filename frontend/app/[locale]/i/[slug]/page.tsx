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
          <EnvelopeReveal
            hostNames={invite.hostNames}
            initials={sealInitials}
            fontClass={sealFontClass}
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
// Envelope reveal — kinematski opener
// ================================================================

function EnvelopeReveal({
  hostNames,
  initials,
  fontClass,
  onOpen,
}: {
  hostNames: string;
  initials: string;
  fontClass: string;
  onOpen: () => void;
}) {
  const [opening, setOpening] = useState(false);

  const handleOpen = () => {
    if (opening) return;
    setOpening(true);
    setTimeout(onOpen, 1600);
  };

  return (
    <motion.div
      exit={{ opacity: 0, transition: { duration: 0.7 } }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden bg-[#0b0906]"
      onClick={handleOpen}
    >
      {/* topli radijalni glow + vinjeta */}
      <div className="pointer-events-none absolute inset-0">
        <motion.div
          animate={{ opacity: [0.5, 0.72, 0.5] }}
          transition={{ repeat: Infinity, duration: 6, ease: 'easeInOut' }}
          className="absolute left-1/2 top-1/2 h-[46rem] w-[46rem] -translate-x-1/2 -translate-y-1/2 rounded-full [background:radial-gradient(circle,rgba(196,150,42,0.32),rgba(120,90,20,0.10)_38%,transparent_66%)]"
        />
        <div className="absolute inset-0 [box-shadow:inset_0_0_320px_120px_rgba(0,0,0,0.82)]" />
        {/* svjetlucave čestice raspoređene po ekranu */}
        {SPARKLES.map((s, i) => (
          <span
            key={i}
            className="absolute rounded-full bg-gold-light shadow-[0_0_6px_rgba(232,205,111,0.9)]"
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

      {/* elegantni zlatni okvir */}
      <div className="pointer-events-none absolute inset-4 rounded-[1.75rem] border border-gold/15 sm:inset-7" />
      <div className="pointer-events-none absolute inset-[1.35rem] rounded-[1.5rem] border border-gold/[0.07] sm:inset-[2rem]" />

      <motion.p
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: opening ? 0 : 0.55, y: 0 }}
        transition={{ delay: 0.4, duration: 0.9 }}
        className="mb-10 text-[10px] uppercase tracking-[0.45em] text-gold-light/70"
      >
        Pozivnica
      </motion.p>

      {/* Koverta */}
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.88 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-[21rem] cursor-pointer sm:w-[30rem]"
        style={{ perspective: 1200 }}
      >
        <motion.div
          animate={opening ? { y: -10, rotateX: 5 } : { y: [0, -7, 0] }}
          transition={
            opening ? { duration: 0.6 } : { repeat: Infinity, duration: 6, ease: 'easeInOut' }
          }
          className="relative rounded-2xl [box-shadow:0_40px_80px_-24px_rgba(0,0,0,0.75),0_8px_24px_-8px_rgba(0,0,0,0.5)]"
          style={{ aspectRatio: '3/2', transformStyle: 'preserve-3d' }}
        >
          <div className="absolute inset-0 overflow-hidden rounded-2xl">
            {/* ivory papir tijela */}
            <div className="absolute inset-0 bg-gradient-to-br from-[#fbf6ec] via-[#f4ecdb] to-[#e9dfca]" />

            {/* donji "V" preklopi — meke sjenke, bez jarkih linija */}
            <div
              className="absolute inset-0"
              style={{
                background:
                  'linear-gradient(128deg, transparent 49.5%, rgba(120,95,40,0.10) 50%, transparent 50.5%), linear-gradient(232deg, transparent 49.5%, rgba(120,95,40,0.10) 50%, transparent 50.5%)',
              }}
            />
            <div
              className="absolute inset-x-0 bottom-0 h-1/2"
              style={{
                clipPath: 'polygon(0 100%, 50% 0, 100% 100%)',
                background: 'linear-gradient(to top, rgba(180,150,80,0.10), transparent)',
              }}
            />

            {/* pismo koje izlazi */}
            <motion.div
              initial={{ y: 0 }}
              animate={opening ? { y: '-60%', scale: 1.03 } : {}}
              transition={{ duration: 0.9, delay: 0.55, ease: [0.16, 1, 0.3, 1] }}
              className="absolute inset-x-8 top-4 bottom-4 rounded-md bg-[#fffdf8] p-4 text-center shadow-[0_2px_12px_rgba(0,0,0,0.12)]"
            >
              <div className="mx-auto mt-3 h-px w-10 bg-gold/50" />
              <p className={`mt-3 text-2xl text-ink/80 ${fontClass}`}>{hostNames}</p>
              <p className="mt-2 text-[9px] uppercase tracking-[0.35em] text-gold-dark/60">
                Pozivamo vas
              </p>
            </motion.div>

            {/* gornji preklop (3D) */}
            <motion.div
              animate={opening ? { rotateX: -175 } : {}}
              transition={{ duration: 1, ease: 'easeInOut' }}
              style={{ transformOrigin: 'top', transformStyle: 'preserve-3d' }}
              className="absolute inset-x-0 top-0 z-10 h-1/2"
            >
              <div
                className="h-full w-full"
                style={{
                  clipPath: 'polygon(0 0, 100% 0, 50% 100%)',
                  background: 'linear-gradient(to bottom, #f6efe0, #ece2ce)',
                  boxShadow: 'inset 0 -2px 6px rgba(120,95,40,0.12)',
                }}
              />
            </motion.div>

            {/* shimmer sweep pri otvaranju */}
            {opening && (
              <motion.div
                initial={{ x: '-130%' }}
                animate={{ x: '130%' }}
                transition={{ duration: 1.1, delay: 0.5, ease: 'easeInOut' }}
                className="absolute inset-y-0 z-20 w-1/3 -skew-x-12"
                style={{
                  background:
                    'linear-gradient(105deg, transparent 15%, rgba(255,255,255,0.6) 50%, transparent 85%)',
                }}
              />
            )}
          </div>

          {/* tanki foil rub */}
          <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-gold/25" />

          {/* WAX PEČAT */}
          <motion.div
            animate={
              opening
                ? { scale: 0.4, y: -30, opacity: 0, transition: { duration: 0.5, ease: 'easeIn' } }
                : { scale: [1, 1.04, 1], transition: { repeat: Infinity, duration: 2.8, ease: 'easeInOut' } }
            }
            whileHover={opening ? undefined : { scale: 1.07 }}
            whileTap={opening ? undefined : { scale: 0.93 }}
            className="absolute left-1/2 top-1/2 z-30 h-24 w-24 -translate-x-1/2 -translate-y-1/2"
          >
            {/* meka sjena voska na papiru */}
            <div className="absolute inset-0 rounded-full [box-shadow:0_12px_26px_-6px_rgba(120,80,10,0.6)]" />
            {/* tijelo voska */}
            <div
              className="relative flex h-full w-full items-center justify-center rounded-full"
              style={{
                background:
                  'radial-gradient(circle at 34% 28%, #f6e39a 0%, #dcb948 34%, #b6902a 70%, #8a6b18 100%)',
              }}
            >
              {/* utisnuti prsten (letterpress) */}
              <div className="absolute inset-[9px] rounded-full [box-shadow:inset_0_2px_3px_rgba(255,247,214,0.55),inset_0_-3px_5px_rgba(90,66,10,0.55)]" />
              <div className="absolute inset-[9px] rounded-full border border-[#7a5f14]/40" />
              {/* spekularni sjaj */}
              <div className="pointer-events-none absolute inset-0 rounded-full [background:radial-gradient(circle_at_32%_26%,rgba(255,255,255,0.6),transparent_42%)]" />
              {/* monogram, ugraviran */}
              <span
                className={`relative text-[1.7rem] leading-none text-[#5c4713] ${fontClass}`}
                style={{ textShadow: '0 1px 0 rgba(255,247,220,0.45)' }}
              >
                {initials}
              </span>
            </div>
          </motion.div>
        </motion.div>
      </motion.div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: opening ? 0 : 1 }}
        transition={{ delay: 1, duration: 0.6 }}
        className="mt-14 flex items-center gap-3 text-[11px] uppercase tracking-[0.32em] text-cream/45"
      >
        <span className="h-px w-6 bg-gold/40" />
        Dodirnite pečat da otvorite
        <span className="h-px w-6 bg-gold/40" />
      </motion.p>
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
