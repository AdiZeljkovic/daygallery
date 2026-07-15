'use client';

import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  motion,
  AnimatePresence,
  useScroll,
  useTransform,
  useSpring,
  useInView,
  useMotionValue,
  useMotionValueEvent,
} from 'motion/react';
import Lenis from 'lenis';
import { useTranslations, useLocale } from 'next-intl';
import {
  ArrowUpRight,
  Phone,
  Plus,
  Star,
  Check,
  QrCode,
  UtensilsCrossed,
  CalendarHeart,
  Images,
  Armchair,
  Globe,
  Menu as MenuIcon,
  X,
} from 'lucide-react';
import { Link, usePathname } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { imageUrl } from '@/lib/menuTypes';

// ── Paleta (izolovan, tamni „editorial luxe" sistem samo za naslovnicu) ──
const INK = '#0a0a0b';
const PAPER = '#f4f0e6';
const GOLD = '#d4af37';
const GOLD_HI = '#f0dc92';

const CONTACT_PHONE = '+387 61 232 381';
const telHref = `tel:${CONTACT_PHONE.replaceAll(' ', '')}`;

interface GalleryShot {
  id: number | string;
  thumbPath?: string | null;
  filePath: string;
  event?: { name: string; clientNames: string | null } | null;
}

// Parallax i teški efekti samo na desktopu — na mobitelu izazivaju flicker/repaint
function useIsDesktop() {
  const [desktop, setDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const on = () => setDesktop(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return desktop;
}

export default function LandingPage() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const lenis = new Lenis({ duration: 1.2, easing: (t) => 1 - Math.pow(1 - t, 3) });
    let raf = 0;
    const loop = (time: number) => {
      lenis.raf(time);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      lenis.destroy();
    };
  }, []);

  const { data: gallery } = useQuery({
    queryKey: ['publicGallery'],
    queryFn: () => api<GalleryShot[]>('/api/public/gallery'),
    staleTime: 300_000,
  });
  const hasGallery = !!gallery?.length;

  return (
    <main
      className="grain relative min-h-screen overflow-x-hidden"
      style={{ background: INK, color: PAPER }}
    >
      <IntroLoader />
      <ScrollProgress />
      <CursorGlow />
      <Nav />
      <Hero />
      <TickerBand />
      <Manifesto />
      <Products />
      <HowItWorks />
      <Numbers />
      {hasGallery && <GalleryStrip shots={gallery!} />}
      <Testimonials />
      <Faq />
      <FinalCta />
    </main>
  );
}

/* ════════════════════════ INTRO ════════════════════════ */

function IntroLoader() {
  const [done, setDone] = useState(true);
  useEffect(() => {
    if (sessionStorage.getItem('sd_intro_v2')) return;
    setDone(false);
    sessionStorage.setItem('sd_intro_v2', '1');
    const t = setTimeout(() => setDone(true), 1900);
    return () => clearTimeout(t);
  }, []);

  const word = 'SPECIAL DAY';
  return (
    <AnimatePresence>
      {!done && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center"
          style={{ background: INK }}
          initial={{ clipPath: 'inset(0 0 0 0)' }}
          exit={{ clipPath: 'inset(0 0 100% 0)' }}
          transition={{ duration: 0.9, ease: [0.76, 0, 0.24, 1] }}
        >
          <div className="overflow-hidden">
            <motion.h1
              className="flex font-display font-bold leading-none tracking-tight"
              style={{ color: PAPER, fontSize: 'clamp(2rem, 9vw, 7rem)' }}
            >
              {word.split('').map((c, i) => (
                <motion.span
                  key={i}
                  initial={{ y: '110%' }}
                  animate={{ y: 0 }}
                  transition={{ delay: 0.15 + i * 0.04, duration: 0.7, ease: [0.33, 1, 0.68, 1] }}
                  className={c === ' ' ? 'w-[0.3em]' : ''}
                >
                  {c === ' ' ? ' ' : c}
                </motion.span>
              ))}
            </motion.h1>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 260, damping: 40 });
  return (
    <motion.div
      className="fixed left-0 top-0 z-[90] h-[2px] w-full origin-left"
      style={{ scaleX, background: `linear-gradient(90deg, ${GOLD}, ${GOLD_HI})` }}
    />
  );
}

function CursorGlow() {
  const x = useMotionValue(-500);
  const y = useMotionValue(-500);
  const sx = useSpring(x, { stiffness: 120, damping: 20 });
  const sy = useSpring(y, { stiffness: 120, damping: 20 });
  useEffect(() => {
    const move = (e: MouseEvent) => {
      x.set(e.clientX);
      y.set(e.clientY);
    };
    window.addEventListener('pointermove', move);
    return () => window.removeEventListener('pointermove', move);
  }, [x, y]);
  return (
    <motion.div
      aria-hidden
      className="pointer-events-none fixed z-[80] hidden h-[26rem] w-[26rem] -translate-x-1/2 -translate-y-1/2 rounded-full lg:block"
      style={{
        left: sx,
        top: sy,
        background: `radial-gradient(circle, ${GOLD}14 0%, transparent 60%)`,
      }}
    />
  );
}

/* ════════════════════════ NAV ════════════════════════ */

function Nav() {
  const t = useTranslations('landing.nav');
  const locale = useLocale();
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const last = useRef(0);
  const { scrollY } = useScroll();

  useMotionValueEvent(scrollY, 'change', (v) => {
    setScrolled(v > 24);
    // ne sakrivaj dok je mobilni meni otvoren
    setHidden(!menuOpen && v > last.current && v > 400);
    last.current = v;
  });

  const links = [
    { href: '#proizvodi', label: t('products') },
    { href: '#galerija', label: t('gallery') },
    { href: '#pitanja', label: t('faq') },
    { href: '#kontakt', label: t('contact') },
  ];

  return (
    <motion.header
      animate={{ y: hidden ? '-120%' : 0 }}
      transition={{ duration: 0.4, ease: [0.33, 1, 0.68, 1] }}
      className="fixed inset-x-0 top-0 z-[70] px-4 pt-4 sm:px-6"
    >
      <nav
        className={`mx-auto max-w-6xl rounded-3xl border px-5 py-2.5 transition-all duration-500 ${
          scrolled || menuOpen ? 'border-white/10 bg-black/60 backdrop-blur-xl' : 'border-transparent'
        }`}
      >
        <div className="flex items-center justify-between">
          <a href="#top" className="group flex items-center gap-2" onClick={() => setMenuOpen(false)}>
            <span className="font-display text-lg font-bold tracking-tight" style={{ color: PAPER }}>
              Special Day
            </span>
            <span
              className="h-1.5 w-1.5 rounded-full transition-transform group-hover:scale-150"
              style={{ background: GOLD }}
            />
          </a>

          {/* Desktop linkovi */}
          <div className="hidden items-center gap-1 md:flex">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="group relative rounded-full px-3.5 py-1.5 text-xs font-semibold uppercase tracking-widest opacity-70 transition-opacity hover:opacity-100"
              >
                {l.label}
                <span
                  className="absolute inset-x-3.5 bottom-1 h-px w-0 transition-all duration-300 group-hover:w-[calc(100%-1.75rem)]"
                  style={{ background: GOLD }}
                />
              </a>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <Link
              href={pathname}
              locale={locale === 'bs' ? 'en' : 'bs'}
              className="flex items-center gap-1.5 rounded-full border border-white/12 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-widest opacity-80 transition-opacity hover:opacity-100"
            >
              <Globe className="h-3 w-3" /> {locale === 'bs' ? 'EN' : 'BS'}
            </Link>
            <Link
              href="/admin"
              className="hidden rounded-full border border-white/20 px-4 py-1.5 text-[11px] font-bold uppercase tracking-widest opacity-90 transition-colors hover:border-white/50 sm:block"
            >
              {t('admin')}
            </Link>
            {/* Hamburger — mobitel */}
            <button
              onClick={() => setMenuOpen((o) => !o)}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/12 md:hidden"
              aria-label="Meni"
            >
              {menuOpen ? <X className="h-4 w-4" /> : <MenuIcon className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Mobilni meni */}
        <AnimatePresence>
          {menuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden md:hidden"
            >
              <div className="mt-3 space-y-1 border-t border-white/10 pt-3">
                {links.map((l) => (
                  <a
                    key={l.href}
                    href={l.href}
                    onClick={() => setMenuOpen(false)}
                    className="block rounded-xl px-3 py-3 text-sm font-semibold uppercase tracking-widest opacity-80 transition-colors hover:bg-white/5"
                  >
                    {l.label}
                  </a>
                ))}
                <Link
                  href="/admin"
                  onClick={() => setMenuOpen(false)}
                  className="btn-glossy mt-2 block rounded-xl px-3 py-3 text-center text-sm font-bold uppercase tracking-widest text-black"
                  style={{ background: GOLD }}
                >
                  {t('admin')}
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>
    </motion.header>
  );
}

/* ════════════════════════ HERO ════════════════════════ */

function Hero() {
  const t = useTranslations('landing.hero');
  const isDesktop = useIsDesktop();
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  const yTitle = useTransform(scrollYProgress, [0, 1], [0, -120]);
  const yBg = useTransform(scrollYProgress, [0, 1], [0, 180]);
  const opacity = useTransform(scrollYProgress, [0, 0.7], [1, 0]);

  const line = { hidden: { y: '110%' }, show: { y: 0 } };

  return (
    <section id="top" ref={ref} className="relative flex min-h-[100svh] flex-col justify-center px-4 pt-28 sm:px-6">
      {/* Aurora pozadina — parallax samo desktop */}
      <motion.div style={isDesktop ? { y: yBg } : undefined} className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <div
          className="absolute -top-1/4 left-1/2 h-[46rem] w-[46rem] -translate-x-1/2 rounded-full opacity-[0.16] blur-[90px] lg:blur-[120px]"
          style={{ background: `radial-gradient(circle, ${GOLD}, transparent 65%)` }}
        />
        <div
          className="absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(244,240,230,.4) 1px, transparent 1px), linear-gradient(90deg, rgba(244,240,230,.4) 1px, transparent 1px)',
            backgroundSize: '64px 64px',
            maskImage: 'radial-gradient(ellipse at center, black 20%, transparent 72%)',
            WebkitMaskImage: 'radial-gradient(ellipse at center, black 20%, transparent 72%)',
          }}
        />
      </motion.div>

      <motion.div style={isDesktop ? { y: yTitle, opacity } : undefined} className="relative z-10 mx-auto w-full max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.7 }}
          className="mb-6 flex items-center gap-3"
        >
          <span className="h-px w-10" style={{ background: GOLD }} />
          <span className="text-[11px] font-semibold uppercase tracking-[0.28em]" style={{ color: GOLD }}>
            {t('eyebrow')}
          </span>
        </motion.div>

        <h1 className="font-display font-bold leading-[0.94] tracking-tight sm:leading-[0.92]" style={{ fontSize: 'clamp(2.4rem, 8vw, 8rem)' }}>
          {[t('title1'), t('title2')].map((ln, i) => (
            <span key={i} className="block overflow-hidden">
              <motion.span
                variants={line}
                initial="hidden"
                animate="show"
                transition={{ delay: 0.35 + i * 0.12, duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
                className="block"
                style={i === 1 ? { fontStyle: 'italic', color: GOLD } : undefined}
              >
                {ln}
              </motion.span>
            </span>
          ))}
        </h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.62 }}
          transition={{ delay: 0.9, duration: 0.8 }}
          className="mt-7 max-w-xl text-base leading-relaxed sm:text-lg"
        >
          {t('sub')}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.05, duration: 0.7 }}
          className="mt-9 flex flex-wrap items-center gap-3"
        >
          <a
            href="#proizvodi"
            className="btn-glossy group flex items-center gap-2 rounded-full px-6 py-3.5 text-sm font-bold text-black"
            style={{ background: GOLD }}
          >
            {t('cta')}
            <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </a>
          <a
            href={telHref}
            className="flex items-center gap-2 rounded-full border border-white/15 px-6 py-3.5 text-sm font-semibold transition-colors hover:border-white/40"
          >
            <Phone className="h-4 w-4" /> {CONTACT_PHONE}
          </a>
        </motion.div>

        {/* Statistike */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.25, duration: 0.8 }}
          className="mt-12 flex flex-wrap gap-x-8 gap-y-6 border-t border-white/8 pt-8 sm:mt-14 sm:gap-x-12"
        >
          <Stat value={500} suffix="+" label={t('statEvents')} />
          <Stat value={120000} suffix="+" label={t('statMemories')} />
          <Stat value={24} suffix="/7" label={t('statSupport')} />
        </motion.div>
      </motion.div>

      <motion.div
        style={isDesktop ? { opacity } : undefined}
        className="absolute bottom-7 left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-2"
      >
        <span className="text-[10px] uppercase tracking-[0.3em] opacity-40">{t('scrollHint')}</span>
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ repeat: Infinity, duration: 1.6 }}
          className="h-8 w-px"
          style={{ background: `linear-gradient(${GOLD}, transparent)` }}
        />
      </motion.div>
    </section>
  );
}

function Stat({ value, suffix, label }: { value: number; suffix: string; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true });
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!inView) return;
    const dur = 1800;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min((now - start) / dur, 1);
      setN(Math.round(value * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, value]);
  const fmt = n >= 1000 ? `${(n / 1000).toFixed(n >= 100000 ? 0 : 1)}k` : String(n);
  return (
    <div ref={ref}>
      <div className="font-display text-3xl font-bold sm:text-4xl">
        {fmt}
        <span style={{ color: GOLD }}>{suffix}</span>
      </div>
      <div className="mt-1 text-[11px] uppercase tracking-widest opacity-45">{label}</div>
    </div>
  );
}

/* ════════════════════════ TICKER ════════════════════════ */

function TickerBand() {
  const items = ['GALERIJE', '✦', 'POZIVNICE', '✦', 'DIGITALNI MENI', '✦', 'RASPORED', '✦', 'NARUČIVANJE', '✦'];
  const row = [...items, ...items];
  const Row = ({ aria }: { aria?: boolean }) => (
    <div className="animate-marquee-slow flex shrink-0 items-center gap-8 pr-8" aria-hidden={aria}>
      {row.map((w, i) => (
        <span
          key={i}
          className={`font-display text-3xl font-bold uppercase tracking-tight sm:text-5xl ${w === '✦' ? '' : 'text-outline-soft'}`}
          style={w === '✦' ? { color: GOLD } : undefined}
        >
          {w}
        </span>
      ))}
    </div>
  );
  return (
    <div className="relative border-y border-white/8 py-5" style={{ background: '#0d0d0e' }}>
      <div className="flex overflow-hidden">
        <Row />
        <Row aria />
      </div>
    </div>
  );
}

/* ════════════════════════ MANIFESTO ════════════════════════ */

function Manifesto() {
  const t = useTranslations('landing');
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 0.85', 'end 0.5'] });
  const words = t('manifesto').split(' ');

  return (
    <section className="px-4 py-28 sm:px-6 sm:py-40">
      <div ref={ref} className="mx-auto max-w-4xl">
        <p className="flex flex-wrap font-display font-semibold leading-[1.35]" style={{ fontSize: 'clamp(1.5rem, 4vw, 3rem)' }}>
          {words.map((w, i) => (
            <ManifestoWord key={i} progress={scrollYProgress} range={[i / words.length, (i + 1.5) / words.length]}>
              {w}
            </ManifestoWord>
          ))}
        </p>
      </div>
    </section>
  );
}

function ManifestoWord({
  children,
  progress,
  range,
}: {
  children: string;
  progress: ReturnType<typeof useScroll>['scrollYProgress'];
  range: [number, number];
}) {
  const opacity = useTransform(progress, range, [0.14, 1]);
  const accent = /^(bez|no|nula|nikad|nikada|zero)/i.test(children);
  return (
    <span className="mr-[0.28em]">
      <motion.span style={{ opacity, color: accent ? GOLD : PAPER, fontStyle: accent ? 'italic' : 'normal' }}>
        {children}
      </motion.span>
    </span>
  );
}

/* ════════════════════════ PRODUCTS ════════════════════════ */

function Products() {
  const t = useTranslations('landing.products');
  const td = useTranslations('landing.demo');

  const products = [
    {
      key: 'menu',
      icon: UtensilsCrossed,
      name: t('menu.name'),
      desc: t('menu.desc'),
      badge: t('menu.badge'),
      features: [t('menu.f1'), t('menu.f2'), t('menu.f3')],
      mock: <MenuMockup td={td} />,
    },
    {
      key: 'gallery',
      icon: Images,
      name: t('gallery.name'),
      desc: t('gallery.desc'),
      features: [t('gallery.f1'), t('gallery.f2'), t('gallery.f3')],
      mock: <GalleryMockup td={td} />,
    },
    {
      key: 'invites',
      icon: CalendarHeart,
      name: t('invites.name'),
      desc: t('invites.desc'),
      features: [t('invites.f1'), t('invites.f2'), t('invites.f3')],
      mock: <InviteMockup td={td} />,
    },
    {
      key: 'seating',
      icon: Armchair,
      name: t('seating.name'),
      desc: t('seating.desc'),
      features: [t('seating.f1'), t('seating.f2'), t('seating.f3')],
      mock: <SeatingMockup />,
    },
  ];

  return (
    <section id="proizvodi" className="px-4 py-20 sm:px-6 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <SectionHead index="01" overline={t('overline')} title={t('title')} />
        <div className="mt-16 space-y-24 sm:space-y-36">
          {products.map(({ key, ...p }, i) => (
            <ProductRow key={key} {...p} index={i + 1} flip={i % 2 === 1} />
          ))}
        </div>
      </div>
    </section>
  );
}

function ProductRow({
  icon: Icon,
  name,
  desc,
  badge,
  features,
  mock,
  index,
  flip,
}: {
  icon: React.ComponentType<{ className?: string }>;
  name: string;
  desc: string;
  badge?: string;
  features: string[];
  mock: React.ReactNode;
  index: number;
  flip: boolean;
}) {
  return (
    <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
      {/* Tekst */}
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className={flip ? 'lg:order-2' : ''}
      >
        <div className="flex items-center gap-4">
          <span className="font-display text-6xl font-bold leading-none text-outline-soft sm:text-7xl">
            0{index}
          </span>
          <span className="flex h-11 w-11 items-center justify-center rounded-full" style={{ background: `${GOLD}22`, color: GOLD }}>
            <Icon className="h-5 w-5" />
          </span>
          {badge && (
            <span className="rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-black" style={{ background: GOLD }}>
              {badge}
            </span>
          )}
        </div>
        <h3 className="mt-5 font-display text-3xl font-bold sm:text-4xl">{name}</h3>
        <p className="mt-4 max-w-md text-[15px] leading-relaxed opacity-55">{desc}</p>
        <ul className="mt-6 space-y-2.5">
          {features.map((f) => (
            <li key={f} className="flex items-center gap-2.5 text-sm opacity-80">
              <span className="flex h-5 w-5 items-center justify-center rounded-full" style={{ background: `${GOLD}20` }}>
                <Check className="h-3 w-3" style={{ color: GOLD }} />
              </span>
              {f}
            </li>
          ))}
        </ul>
      </motion.div>

      {/* Mockup */}
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className={`flex justify-center ${flip ? 'lg:order-1' : ''}`}
        style={{ perspective: 1000 }}
      >
        {mock}
      </motion.div>
    </div>
  );
}

function Phone3D({ children, tone = '#111013' }: { children: React.ReactNode; tone?: string }) {
  return (
    <motion.div
      whileHover={{ y: -10 }}
      transition={{ type: 'spring', stiffness: 200, damping: 18 }}
      className="relative w-[15rem] rounded-[2.4rem] border border-white/10 p-2.5 shadow-[0_40px_80px_-20px_rgba(0,0,0,0.7)]"
      style={{ background: tone }}
    >
      <div className="absolute left-1/2 top-3 z-10 h-1.5 w-16 -translate-x-1/2 rounded-full bg-white/15" />
      <div className="overflow-hidden rounded-[1.9rem] bg-black/40 pt-7">{children}</div>
    </motion.div>
  );
}

function MenuMockup({ td }: { td: ReturnType<typeof useTranslations> }) {
  return (
    <Phone3D>
      <div className="space-y-2 px-3 pb-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-2 rounded-xl border border-white/8 bg-white/[0.03] p-2">
            <div className="h-9 w-9 rounded-lg" style={{ background: `${GOLD}${i === 0 ? '55' : '22'}` }} />
            <div className="flex-1">
              <div className="h-2 w-16 rounded bg-white/25" />
              <div className="mt-1.5 h-1.5 w-10 rounded" style={{ background: GOLD }} />
            </div>
            <div className="flex h-6 w-6 items-center justify-center rounded-full" style={{ background: GOLD }}>
              <Plus className="h-3 w-3 text-black" />
            </div>
          </div>
        ))}
        <motion.div
          initial={{ opacity: 0.6 }}
          animate={{ opacity: [0.6, 1, 0.6] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="mt-3 rounded-xl border border-white/10 p-2.5"
          style={{ background: `${GOLD}12` }}
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[9px] font-bold uppercase tracking-wide" style={{ color: GOLD }}>
                {td('order.title')}
              </div>
              <div className="mt-0.5 text-[8px] text-white/40">{td('order.table')} · {td('order.item1')}</div>
            </div>
            <div className="rounded-full px-2.5 py-1 text-[8px] font-bold text-black" style={{ background: GOLD }}>
              {td('order.accept')}
            </div>
          </div>
        </motion.div>
      </div>
    </Phone3D>
  );
}

function GalleryMockup({ td }: { td: ReturnType<typeof useTranslations> }) {
  const heights = [56, 40, 48, 64, 44, 52];
  return (
    <Phone3D>
      <div className="px-3 pb-4">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-1 text-[9px] font-bold" style={{ color: GOLD }}>
            <Images className="h-3 w-3" /> {td('gallery.count')}
          </div>
          <QrCode className="h-3.5 w-3.5 text-white/30" />
        </div>
        <div className="columns-2 gap-1.5">
          {heights.map((h, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="mb-1.5 rounded-lg"
              style={{ height: h, background: `linear-gradient(135deg, ${GOLD}${i % 2 ? '33' : '22'}, rgba(255,255,255,0.05))` }}
            />
          ))}
        </div>
      </div>
    </Phone3D>
  );
}

function InviteMockup({ td }: { td: ReturnType<typeof useTranslations> }) {
  return (
    <Phone3D tone="#0e130f">
      <div className="px-3 pb-4 text-center">
        <div className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-full" style={{ background: `${GOLD}22` }}>
          <CalendarHeart className="h-4 w-4" style={{ color: GOLD }} />
        </div>
        <div className="font-display text-sm italic" style={{ color: GOLD_HI }}>{td('rsvp.names')}</div>
        <div className="mt-3 flex justify-center gap-1.5">
          {['12', '08', '45', '20'].map((v, i) => (
            <div key={i} className="rounded-md border border-white/10 bg-white/[0.03] px-1.5 py-1">
              <div className="font-display text-xs font-bold">{v}</div>
            </div>
          ))}
        </div>
        <motion.div
          initial={{ scale: 0.94 }}
          whileInView={{ scale: 1 }}
          viewport={{ once: true }}
          className="mt-3 rounded-full py-1.5 text-[9px] font-bold text-black"
          style={{ background: GOLD }}
        >
          {td('rsvp.reply')} · {td('rsvp.guests')}
        </motion.div>
      </div>
    </Phone3D>
  );
}

function SeatingMockup() {
  return (
    <Phone3D>
      <div className="px-3 pb-4">
        <div className="mb-2 h-6 rounded-full border border-white/10 bg-white/[0.04]" />
        <div className="grid grid-cols-3 gap-1.5">
          {Array.from({ length: 9 }).map((_, i) => {
            const vip = i === 4;
            const mine = i === 2;
            return (
              <div
                key={i}
                className="flex aspect-square items-center justify-center rounded-lg text-[8px] font-bold"
                style={{
                  background: mine ? GOLD : vip ? `${GOLD}33` : 'rgba(255,255,255,0.04)',
                  color: mine ? '#000' : vip ? GOLD : 'rgba(255,255,255,0.4)',
                  border: mine ? 'none' : '1px solid rgba(255,255,255,0.08)',
                }}
              >
                {vip ? 'VIP' : i + 1}
              </div>
            );
          })}
        </div>
      </div>
    </Phone3D>
  );
}

/* ════════════════════════ HOW ════════════════════════ */

function HowItWorks() {
  const t = useTranslations('landing.how');
  const steps = [
    { t: t('s1t'), d: t('s1d') },
    { t: t('s2t'), d: t('s2d') },
    { t: t('s3t'), d: t('s3d') },
    { t: t('s4t'), d: t('s4d') },
  ];
  return (
    <section className="px-4 py-20 sm:px-6 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <SectionHead index="02" overline={t('overline')} title={t('title')} />
        <div className="mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.6 }}
              className="relative border-t border-white/10 pt-5"
            >
              <div className="absolute -top-[2px] left-0 h-[2px] w-10" style={{ background: GOLD }} />
              <div className="font-display text-4xl font-bold text-outline-soft">0{i + 1}</div>
              <h4 className="mt-3 font-display text-lg font-bold">{s.t}</h4>
              <p className="mt-2 text-sm leading-relaxed opacity-50">{s.d}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ════════════════════════ NUMBERS ════════════════════════ */

function Numbers() {
  const t = useTranslations('landing.hero');
  return (
    <section className="relative overflow-hidden px-4 py-24 sm:px-6" style={{ background: '#0d0d0e' }}>
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.10]"
        style={{ background: `radial-gradient(circle at 50% 120%, ${GOLD}, transparent 55%)` }}
      />
      <div className="relative mx-auto grid max-w-5xl gap-10 text-center sm:grid-cols-3">
        <BigNum value={500} suffix="+" label={t('statEvents')} />
        <BigNum value={120000} suffix="+" label={t('statMemories')} />
        <BigNum value={100} suffix="%" label={t('trustedBy')} small />
      </div>
    </section>
  );
}

function BigNum({ value, suffix, label, small }: { value: number; suffix: string; label: string; small?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true });
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!inView) return;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min((now - start) / 2000, 1);
      setN(Math.round(value * (1 - Math.pow(1 - p, 4))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, value]);
  const fmt = n >= 1000 ? `${(n / 1000).toFixed(0)}k` : String(n);
  return (
    <div ref={ref}>
      <div className="font-display font-bold leading-none" style={{ fontSize: 'clamp(2.6rem, 7.5vw, 5.5rem)' }}>
        {fmt}
        <span style={{ color: GOLD }}>{suffix}</span>
      </div>
      <div className={`mx-auto mt-3 ${small ? 'max-w-[16rem] text-xs' : 'text-sm'} uppercase tracking-widest opacity-45`}>
        {label}
      </div>
    </div>
  );
}

/* ════════════════════════ GALLERY STRIP ════════════════════════ */

function GalleryStrip({ shots }: { shots: GalleryShot[] }) {
  const t = useTranslations('landing.galleryStrip');
  const rowA = [...shots, ...shots].slice(0, 16);
  const rowB = [...shots].reverse();
  const rowBFull = [...rowB, ...rowB].slice(0, 16);

  return (
    <section id="galerija" className="overflow-hidden py-20 sm:py-28">
      <div className="mx-auto mb-12 max-w-6xl px-4 sm:px-6">
        <SectionHead index="03" overline={t('overline')} title={t('title')} />
      </div>
      <div className="space-y-4">
        <div className="flex overflow-hidden">
          <StripRow shots={rowA} className="animate-marquee-slow" />
          <StripRow shots={rowA} className="animate-marquee-slow" aria />
        </div>
        <div className="flex overflow-hidden">
          <StripRow shots={rowBFull} className="animate-marquee-reverse" />
          <StripRow shots={rowBFull} className="animate-marquee-reverse" aria />
        </div>
      </div>
    </section>
  );
}

function StripRow({ shots, className, aria }: { shots: GalleryShot[]; className: string; aria?: boolean }) {
  return (
    <div className={`flex shrink-0 gap-4 pr-4 ${className}`} aria-hidden={aria}>
      {shots.map((s, i) => (
        <div key={`${s.id}-${i}`} className="group relative h-52 w-72 shrink-0 overflow-hidden rounded-2xl sm:h-64 sm:w-96">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl(s.thumbPath || s.filePath)!}
            alt={s.event?.clientNames ?? ''}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
          {(s.event?.clientNames || s.event?.name) && (
            <div className="absolute bottom-3 left-3 translate-y-2 opacity-0 transition-all group-hover:translate-y-0 group-hover:opacity-100">
              <p className="font-display text-sm font-bold">{s.event?.clientNames}</p>
              <p className="text-[11px] opacity-70">{s.event?.name}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ════════════════════════ TESTIMONIALS ════════════════════════ */

function Testimonials() {
  const t = useTranslations('landing.testimonials');
  const quotes = [
    { q: t('q1'), a: t('q1a'), i: t('q1i') },
    { q: t('q2'), a: t('q2a'), i: t('q2i') },
    { q: t('q3'), a: t('q3a'), i: t('q3i') },
  ];
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setIdx((v) => (v + 1) % quotes.length), 6000);
    return () => clearInterval(id);
  }, [quotes.length]);

  return (
    <section className="px-4 py-24 sm:px-6 sm:py-32">
      <div className="mx-auto max-w-4xl">
        <SectionHead index="04" overline={t('overline')} title={t('title')} center />
        <div className="relative mt-14 min-h-[16rem] text-center">
          <AnimatePresence mode="wait">
            <motion.blockquote
              key={idx}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -24 }}
              transition={{ duration: 0.5 }}
            >
              <div className="mb-6 flex justify-center gap-1">
                {[0, 1, 2, 3, 4].map((s) => (
                  <Star key={s} className="h-4 w-4" style={{ color: GOLD, fill: GOLD }} />
                ))}
              </div>
              <p className="font-display text-2xl font-medium leading-snug sm:text-3xl">
                “{quotes[idx].q}”
              </p>
              <div className="mt-8">
                <div className="font-semibold" style={{ color: GOLD }}>{quotes[idx].a}</div>
                <div className="mt-1 text-xs uppercase tracking-widest opacity-40">{quotes[idx].i}</div>
              </div>
            </motion.blockquote>
          </AnimatePresence>
        </div>
        <div className="mt-6 flex justify-center gap-2">
          {quotes.map((_, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              className="h-1.5 rounded-full transition-all"
              style={{ width: i === idx ? 32 : 8, background: i === idx ? GOLD : 'rgba(255,255,255,0.2)' }}
              aria-label={`Utisak ${i + 1}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

/* ════════════════════════ FAQ ════════════════════════ */

function Faq() {
  const t = useTranslations('landing.faq');
  const items = [
    { q: t('q1'), a: t('a1') },
    { q: t('q2'), a: t('a2') },
    { q: t('q3'), a: t('a3') },
    { q: t('q4'), a: t('a4') },
  ];
  const [open, setOpen] = useState(0);

  return (
    <section id="pitanja" className="px-4 py-20 sm:px-6 sm:py-28">
      <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[0.8fr_1.2fr]">
        <SectionHead index="05" overline={t('overline')} title={t('title')} />
        <div className="space-y-3">
          {items.map((it, i) => {
            const active = open === i;
            return (
              <div
                key={i}
                className="overflow-hidden rounded-2xl border transition-colors"
                style={{ borderColor: active ? `${GOLD}55` : 'rgba(255,255,255,0.08)', background: active ? `${GOLD}0d` : 'transparent' }}
              >
                <button
                  onClick={() => setOpen(active ? -1 : i)}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                >
                  <span className="font-display text-base font-semibold sm:text-lg">{it.q}</span>
                  <motion.span animate={{ rotate: active ? 45 : 0 }} className="shrink-0" style={{ color: GOLD }}>
                    <Plus className="h-5 w-5" />
                  </motion.span>
                </button>
                <AnimatePresence initial={false}>
                  {active && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <p className="px-5 pb-5 text-sm leading-relaxed opacity-60">{it.a}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ════════════════════════ FINAL CTA + FOOTER ════════════════════════ */

function FinalCta() {
  const t = useTranslations('landing.contact');
  const tn = useTranslations('landing.nav');
  const tf = useTranslations('landing.footer');
  const isDesktop = useIsDesktop();
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end end'] });
  const yGlow = useTransform(scrollYProgress, [0, 1], [120, 0]);

  return (
    <footer id="kontakt" ref={ref} className="relative overflow-hidden px-4 pt-24 sm:px-6 sm:pt-36">
      <motion.div style={isDesktop ? { y: yGlow } : undefined} className="pointer-events-none absolute inset-x-0 bottom-0 h-[30rem]">
        <div
          className="absolute bottom-0 left-1/2 h-[30rem] w-[50rem] -translate-x-1/2 rounded-full opacity-[0.14] blur-[110px]"
          style={{ background: `radial-gradient(circle, ${GOLD}, transparent 65%)` }}
        />
      </motion.div>

      <div className="relative mx-auto max-w-4xl text-center">
        <span className="text-[11px] font-semibold uppercase tracking-[0.28em]" style={{ color: GOLD }}>
          {t('overline')}
        </span>
        <h2 className="mt-5 font-display font-bold leading-[0.95]" style={{ fontSize: 'clamp(2.4rem, 7vw, 5.5rem)' }}>
          {t('finalTitle1')}<br />
          <span style={{ fontStyle: 'italic', color: GOLD }}>{t('finalTitle2')}</span>
        </h2>
        <p className="mx-auto mt-6 max-w-md text-base opacity-55">{t('sub')}</p>
        <a
          href={telHref}
          className="btn-glossy group mt-9 inline-flex items-center gap-2.5 rounded-full px-8 py-4 text-base font-bold text-black"
          style={{ background: GOLD }}
        >
          <Phone className="h-5 w-5" />
          {t('call')} · {CONTACT_PHONE}
        </a>
      </div>

      <div className="relative mx-auto mt-24 flex max-w-6xl flex-col items-center justify-between gap-6 border-t border-white/8 py-8 sm:flex-row">
        <div className="flex items-center gap-2">
          <span className="font-display text-lg font-bold">Special Day</span>
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: GOLD }} />
        </div>
        <div className="flex items-center gap-6 text-xs uppercase tracking-widest opacity-50">
          <a href="#proizvodi" className="transition-opacity hover:opacity-100">{tn('products')}</a>
          <a href="#galerija" className="transition-opacity hover:opacity-100">{tn('gallery')}</a>
          <a href="#pitanja" className="transition-opacity hover:opacity-100">{tn('faq')}</a>
          <a href={telHref} className="flex items-center gap-1.5 transition-opacity hover:opacity-100">
            <Phone className="h-3 w-3" /> {CONTACT_PHONE}
          </a>
        </div>
        <p className="text-[11px] opacity-30">© {new Date().getFullYear()} · {tf('rights')}</p>
      </div>
    </footer>
  );
}

/* ════════════════════════ SHARED ════════════════════════ */

function SectionHead({
  index,
  overline,
  title,
  center,
}: {
  index: string;
  overline: string;
  title: string;
  center?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6 }}
      className={center ? 'text-center' : ''}
    >
      <div className={`flex items-center gap-3 ${center ? 'justify-center' : ''}`}>
        <span className="font-mono text-xs font-bold text-white/35">{index}</span>
        <span className="h-px w-8" style={{ background: `${GOLD}99` }} />
        <span className="text-[11px] font-semibold uppercase tracking-[0.28em] opacity-55">{overline}</span>
      </div>
      <h2 className="mt-4 max-w-2xl font-display font-bold leading-[1.05]" style={{ fontSize: 'clamp(1.9rem, 5vw, 3.5rem)' }}>
        {title}
      </h2>
    </motion.div>
  );
}
