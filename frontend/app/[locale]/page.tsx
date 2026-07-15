'use client';

import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations, useLocale } from 'next-intl';
import Lenis from 'lenis';
import {
  motion,
  AnimatePresence,
  useInView,
  useScroll,
  useTransform,
  type MotionValue,
} from 'motion/react';
import {
  Camera,
  Mail,
  Armchair,
  UtensilsCrossed,
  Check,
  ChevronDown,
  Menu as MenuIcon,
  X,
  Phone,
  Globe,
  Heart,
  ArrowUpRight,
  ArrowDown,
  ShoppingBag,
} from 'lucide-react';
import { Link, usePathname, useRouter } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { imageUrl } from '@/lib/menuTypes';

const CONTACT_PHONE = '+387 61 232 381';
const INK = '#0c0b09';
const PAPER = '#f5f1e8';

interface PublicImage {
  id: number;
  thumbPath: string;
  filePath: string;
  width: number;
  height: number;
  event: { name: string; clientNames: string | null };
}

export default function LandingPage() {
  // Lenis smooth scroll — "skupi" osjećaj inercije
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const lenis = new Lenis({ duration: 1.15, smoothWheel: true });
    let rafId: number;
    const raf = (time: number) => {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    };
    rafId = requestAnimationFrame(raf);
    return () => {
      lenis.destroy();
      cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <main className="grain text-[#f5f1e8]" style={{ backgroundColor: INK }}>
      <IntroLoader />
      <Nav />
      <Hero />
      <OutlineMarquee />
      <Manifesto />
      <Products />
      <Numbers />
      <GalleryMarquee />
      <Testimonials />
      <Faq />
      <FinalCta />
    </main>
  );
}

// ================================================================
// Intro loader — jednom po sesiji
// ================================================================

function IntroLoader() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem('sd_intro')) return;
    sessionStorage.setItem('sd_intro', '1');
    setShow(true);
    document.body.style.overflow = 'hidden';
    const t = setTimeout(() => {
      setShow(false);
      document.body.style.overflow = '';
    }, 1700);
    return () => {
      clearTimeout(t);
      document.body.style.overflow = '';
    };
  }, []);

  const letters = 'Special Day'.split('');

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          exit={{ y: '-100%' }}
          transition={{ duration: 0.75, ease: [0.76, 0, 0.24, 1] }}
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center"
          style={{ backgroundColor: INK }}
        >
          <div className="flex overflow-hidden font-display text-4xl font-bold sm:text-6xl">
            {letters.map((letter, i) => (
              <motion.span
                key={i}
                initial={{ y: '110%' }}
                animate={{ y: 0 }}
                transition={{ duration: 0.6, delay: 0.15 + i * 0.045, ease: [0.22, 1, 0.36, 1] }}
              >
                {letter === ' ' ? ' ' : letter}
              </motion.span>
            ))}
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.9, type: 'spring', stiffness: 400, damping: 16 }}
              className="text-gold"
            >
              .
            </motion.span>
          </div>
          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.9, delay: 0.5, ease: 'easeInOut' }}
            className="mt-6 h-px w-40 origin-left bg-gold/60"
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ================================================================
// Navigacija
// ================================================================

function Nav() {
  const t = useTranslations('landing.nav');
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const lastY = useRef(0);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      setScrolled(y > 30);
      setHidden(y > 500 && y > lastY.current);
      lastY.current = y;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Isti (keširani) query kao galerija — da ne prikazujemo mrtav link kad je prazna
  const { data: galleryImages } = useQuery({
    queryKey: ['publicGallery'],
    queryFn: () => api<PublicImage[]>('/api/public/gallery'),
    staleTime: 60_000,
  });
  const hasGallery = !!galleryImages?.length;

  const links = [
    { href: '#proizvodi', label: t('products') },
    ...(hasGallery ? [{ href: '#galerija', label: t('gallery') }] : []),
    { href: '#faq', label: t('faq') },
    { href: '#kontakt', label: t('contact') },
  ];

  const switchLocale = () => router.replace(pathname, { locale: locale === 'bs' ? 'en' : 'bs' });

  return (
    <motion.nav
      animate={{ y: hidden && !mobileOpen ? '-100%' : '0%' }}
      transition={{ duration: 0.35, ease: 'easeInOut' }}
      className={`fixed inset-x-0 top-0 z-50 transition-colors duration-300 ${
        scrolled ? 'border-b border-[#f5f1e8]/8 bg-[#0c0b09]/75 backdrop-blur-xl' : ''
      }`}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <a href="#" className="group font-display text-xl font-bold">
          Special Day
          <span className="inline-block text-gold transition-transform duration-300 group-hover:scale-150">
            .
          </span>
        </a>

        <div className="hidden items-center gap-9 md:flex">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="group relative text-[13px] font-medium uppercase tracking-widest text-[#f5f1e8]/50 transition-colors hover:text-[#f5f1e8]"
            >
              {link.label}
              <span className="absolute -bottom-1 left-0 h-px w-0 bg-gold transition-all duration-300 group-hover:w-full" />
            </a>
          ))}
        </div>

        <div className="hidden items-center gap-3 md:flex">
          <button
            onClick={switchLocale}
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold uppercase text-[#f5f1e8]/50 transition-colors hover:bg-[#f5f1e8]/8 hover:text-[#f5f1e8]"
          >
            <Globe className="h-3.5 w-3.5" />
            {locale === 'bs' ? 'EN' : 'BS'}
          </button>
          <Link
            href="/admin/login"
            className="btn-glossy rounded-full bg-gold px-5 py-2 text-sm font-semibold text-[#141210]"
          >
            {t('admin')}
          </Link>
        </div>

        <button className="rounded-lg p-2 md:hidden" onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X className="h-5 w-5" /> : <MenuIcon className="h-5 w-5" />}
        </button>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden border-t border-[#f5f1e8]/8 bg-[#0c0b09]/95 backdrop-blur-xl md:hidden"
          >
            <div className="space-y-1 px-6 py-4">
              {links.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className="block rounded-lg px-3 py-3 font-display text-lg font-semibold text-[#f5f1e8]/80"
                >
                  {link.label}
                </a>
              ))}
              <div className="flex items-center gap-2 pt-3">
                <button
                  onClick={switchLocale}
                  className="flex items-center gap-1.5 rounded-full bg-[#f5f1e8]/8 px-4 py-2.5 text-xs font-semibold uppercase"
                >
                  <Globe className="h-3.5 w-3.5" /> {locale === 'bs' ? 'EN' : 'BS'}
                </button>
                <Link
                  href="/admin/login"
                  className="btn-glossy flex-1 rounded-full bg-gold px-3 py-2.5 text-center text-sm font-semibold text-[#141210]"
                >
                  {t('admin')}
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
}

// ================================================================
// Hero — centrirana gigantska tipografija
// ================================================================

function Hero() {
  const t = useTranslations('landing.hero');
  const ref = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  const yBg = useTransform(scrollYProgress, [0, 1], [0, 200]);
  const yType = useTransform(scrollYProgress, [0, 1], [0, -80]);
  const opacity = useTransform(scrollYProgress, [0, 0.85], [1, 0]);

  return (
    <section
      ref={ref}
      className="relative flex min-h-[100svh] flex-col justify-center overflow-hidden pt-24"
    >
      {/* Pozadina: centralni glow + mreža tačaka */}
      <motion.div style={{ y: yBg }} className="pointer-events-none absolute inset-0">
        <motion.div
          animate={{ scale: [1, 1.08, 1], opacity: [0.09, 0.14, 0.09] }}
          transition={{ repeat: Infinity, duration: 9, ease: 'easeInOut' }}
          className="absolute left-1/2 top-[30%] h-[34rem] w-[58rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold blur-3xl"
        />
        <div
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage: 'radial-gradient(rgba(245,241,232,0.05) 1px, transparent 1px)',
            backgroundSize: '32px 32px',
            maskImage: 'radial-gradient(ellipse 70% 60% at 50% 42%, black, transparent)',
          }}
        />
      </motion.div>

      {/* Tipografija — centrirana */}
      <motion.div
        style={{ y: yType, opacity }}
        className="relative z-10 mx-auto w-full max-w-5xl px-6 text-center"
      >
        <motion.p
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mb-9 inline-flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.3em] text-gold"
        >
          <span className="h-px w-10 bg-gold/60" />
          {t('eyebrow')}
          <span className="h-px w-10 bg-gold/60" />
        </motion.p>

        <h1 className="font-display font-bold leading-[1.02] tracking-tight">
          <span className="block overflow-hidden">
            <motion.span
              initial={{ y: '105%' }}
              animate={{ y: 0 }}
              transition={{ duration: 0.9, delay: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="block text-[clamp(2.7rem,7vw,6.5rem)]"
            >
              {t('title1')}
            </motion.span>
          </span>
          <span className="block overflow-hidden">
            <motion.span
              initial={{ y: '105%' }}
              animate={{ y: 0 }}
              transition={{ duration: 0.9, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="block text-[clamp(2.7rem,7vw,6.5rem)] italic text-gold"
            >
              {t('title2')}
            </motion.span>
          </span>
        </h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.85 }}
          className="mx-auto mt-8 max-w-xl text-base leading-relaxed text-[#f5f1e8]/50 sm:text-lg"
        >
          {t('sub')}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 1 }}
          className="mt-10 flex flex-wrap items-center justify-center gap-4"
        >
          <a
            href="#proizvodi"
            className="btn-glossy group inline-flex items-center gap-3 rounded-full bg-gold py-2 pl-7 pr-2 font-semibold text-[#141210]"
          >
            {t('cta')}
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#141210]/90 text-gold transition-transform duration-300 ease-out group-hover:rotate-45">
              <ArrowUpRight className="h-4 w-4" />
            </span>
          </a>
          <a
            href={`tel:${CONTACT_PHONE.replaceAll(' ', '')}`}
            className="inline-flex items-center gap-2 rounded-full border border-[#f5f1e8]/15 px-6 py-3 text-sm font-medium text-[#f5f1e8]/70 transition-colors hover:border-gold/50 hover:text-gold"
          >
            <Phone className="h-4 w-4" />
            {CONTACT_PHONE}
          </a>
        </motion.div>

        {/* Statistike */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.3 }}
          className="mx-auto mt-16 flex max-w-2xl items-center justify-center gap-8 border-t border-[#f5f1e8]/8 pt-7 sm:gap-14"
        >
          <Stat value={50} suffix="+" label={t('statEvents')} />
          <span className="h-8 w-px bg-[#f5f1e8]/10" />
          <Stat value={10000} suffix="+" label={t('statMemories')} />
          <span className="h-8 w-px bg-[#f5f1e8]/10" />
          <Stat value={24} suffix="/7" label={t('statSupport')} />
        </motion.div>
      </motion.div>

      {/* Scroll indikator */}
      <motion.a
        href="#manifest"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.6 }}
        className="absolute bottom-8 left-1/2 z-10 -translate-x-1/2"
        aria-label={t('scrollHint')}
      >
        <motion.span
          animate={{ y: [0, 6, 0] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-[#f5f1e8]/15 text-[#f5f1e8]/40 transition-colors hover:border-gold/50 hover:text-gold"
        >
          <ArrowDown className="h-4 w-4" />
        </motion.span>
      </motion.a>
    </section>
  );
}

function Stat({ value, suffix, label }: { value: number; suffix: string; label: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const start = performance.now();
    let raf: number;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / 1800);
      setDisplay(Math.round(value * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, value]);

  return (
    <div>
      <span ref={ref} className="font-display text-2xl font-bold text-gold sm:text-3xl">
        {display.toLocaleString('bs-BA')}
        {suffix}
      </span>
      <p className="mt-0.5 text-[10px] uppercase tracking-[0.2em] text-[#f5f1e8]/35">{label}</p>
    </div>
  );
}

// ================================================================
// Outline marquee — ogromna šuplja tipografija
// ================================================================

function OutlineMarquee() {
  const t = useTranslations('landing.products');
  const items = [t('gallery.name'), t('invites.name'), t('seating.name'), t('menu.name')];

  return (
    <div className="marquee-pause overflow-hidden border-y border-[#f5f1e8]/6 py-6">
      <div className="animate-marquee-slow flex w-max items-center gap-12">
        {[...items, ...items, ...items, ...items].map((item, i) => (
          <span key={i} className="flex items-center gap-12 whitespace-nowrap">
            <span className="text-outline-gold font-display text-5xl font-bold uppercase sm:text-7xl">
              {item}
            </span>
            <span className="h-2.5 w-2.5 rounded-full bg-gold/50" />
          </span>
        ))}
      </div>
    </div>
  );
}

// ================================================================
// Manifesto — riječi se pale dok skrolaš
// ================================================================

function Manifesto() {
  const t = useTranslations('landing');
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 0.85', 'end 0.45'] });
  const words = t('manifesto').split(' ');

  return (
    <section id="manifest" className="scroll-mt-20 px-6 py-36 sm:py-44">
      <div ref={ref} className="mx-auto max-w-4xl">
        <p className="flex flex-wrap gap-x-[0.35em] gap-y-2 font-display text-[clamp(1.6rem,4vw,3.2rem)] font-semibold leading-[1.25]">
          {words.map((word, i) => (
            <ManifestoWord
              key={i}
              word={word}
              progress={scrollYProgress}
              start={i / words.length}
              end={(i + 1) / words.length}
            />
          ))}
        </p>
      </div>
    </section>
  );
}

function ManifestoWord({
  word,
  progress,
  start,
  end,
}: {
  word: string;
  progress: MotionValue<number>;
  start: number;
  end: number;
}) {
  const opacity = useTransform(progress, [start, end], [0.12, 1]);
  const gold = word.startsWith('Bez') || word.startsWith('No') || word.startsWith('Nula');
  return (
    <motion.span style={{ opacity }} className={gold ? 'italic text-gold' : undefined}>
      {word}
    </motion.span>
  );
}

// ================================================================
// Proizvodi — sticky deck (kartice se slažu jedna preko druge)
// ================================================================

function Products() {
  const t = useTranslations('landing.products');
  const td = useTranslations('landing.demo');

  const products = [
    {
      icon: UtensilsCrossed,
      badge: t('menu.badge'),
      name: t('menu.name'),
      desc: t('menu.desc'),
      features: [t('menu.f1'), t('menu.f2'), t('menu.f3')],
      visual: <MenuMockup td={td} />,
      tone: '#17130c',
    },
    {
      icon: Camera,
      name: t('gallery.name'),
      desc: t('gallery.desc'),
      features: [t('gallery.f1'), t('gallery.f2'), t('gallery.f3')],
      visual: <GalleryMockup />,
      tone: '#141110',
    },
    {
      icon: Mail,
      name: t('invites.name'),
      desc: t('invites.desc'),
      features: [t('invites.f1'), t('invites.f2'), t('invites.f3')],
      visual: <InviteMockup td={td} />,
      tone: '#16120e',
    },
    {
      icon: Armchair,
      name: t('seating.name'),
      desc: t('seating.desc'),
      features: [t('seating.f1'), t('seating.f2'), t('seating.f3')],
      visual: <SeatingMockup />,
      tone: '#131110',
    },
  ];

  return (
    <section id="proizvodi" className="scroll-mt-20 px-4 pb-32 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <SectionLabel index="01" label={t('overline')} />
        <h2 className="mt-4 max-w-2xl font-display text-4xl font-bold leading-tight sm:text-6xl">
          {t('title')}
        </h2>

        <div className="mt-16">
          {products.map((product, i) => (
            <div key={i} className="sticky" style={{ top: `${88 + i * 24}px` }}>
              <motion.article
                initial={{ opacity: 0, y: 60 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-80px' }}
                transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                className="mb-8 overflow-hidden rounded-[2rem] border border-[#f5f1e8]/8 shadow-lifted"
                style={{ backgroundColor: product.tone }}
              >
                <div className="grid items-center gap-8 p-8 sm:p-12 lg:grid-cols-2 lg:gap-14">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-display text-sm font-bold text-gold/50">
                        {String(i + 1).padStart(2, '0')} / {String(products.length).padStart(2, '0')}
                      </span>
                      {product.badge && (
                        <span className="rounded-full bg-gold px-3.5 py-1 text-[11px] font-bold uppercase tracking-wider text-[#141210]">
                          {product.badge}
                        </span>
                      )}
                    </div>
                    <div className="mt-6 flex items-center gap-4">
                      <span className="flex h-13 w-13 items-center justify-center rounded-2xl bg-gold/12 p-3.5">
                        <product.icon className="h-6 w-6 text-gold" />
                      </span>
                      <h3 className="font-display text-2xl font-bold sm:text-4xl">{product.name}</h3>
                    </div>
                    <p className="mt-5 max-w-md leading-relaxed text-[#f5f1e8]/50 sm:text-lg">
                      {product.desc}
                    </p>
                    <ul className="mt-7 space-y-3.5">
                      {product.features.map((feature) => (
                        <li key={feature} className="flex items-center gap-3 text-sm font-medium text-[#f5f1e8]/75">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-gold/30 bg-gold/10">
                            <Check className="h-3 w-3 text-gold" />
                          </span>
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="max-lg:order-first">{product.visual}</div>
                </div>
              </motion.article>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* --------- CSS mockupi telefona --------- */

function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[18rem]">
      <motion.div
        whileHover={{ y: -8 }}
        transition={{ type: 'spring', stiffness: 200, damping: 22 }}
        className="rounded-[2.2rem] border border-[#f5f1e8]/12 bg-[#0a0908] p-2.5 shadow-lifted"
      >
        <div className="overflow-hidden rounded-[1.7rem] bg-[#12100d] text-[#f5f1e8]">{children}</div>
      </motion.div>
    </div>
  );
}

function MenuMockup({ td }: { td: ReturnType<typeof useTranslations> }) {
  return (
    <PhoneFrame>
      <div className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-display text-sm font-bold">Caffe Central</p>
            <p className="text-[9px] text-[#f5f1e8]/35">Ferhadija 12 · Sarajevo</p>
          </div>
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gold/15">
            <UtensilsCrossed className="h-3.5 w-3.5 text-gold" />
          </span>
        </div>
        <div className="mt-3 flex gap-1.5">
          {['Hrana', 'Pića', 'Deserti'].map((c, i) => (
            <span
              key={c}
              className={`rounded-full px-2.5 py-1 text-[9px] font-semibold ${
                i === 1 ? 'bg-gold text-[#141210]' : 'bg-[#f5f1e8]/8 text-[#f5f1e8]/50'
              }`}
            >
              {c}
            </span>
          ))}
        </div>
        <div className="mt-3 space-y-2">
          {[
            { name: 'Cappuccino', price: '3.50', tone: '#7a6242' },
            { name: 'Limunada', price: '3.50', tone: '#95815e' },
            { name: 'Espresso', price: '2.50', tone: '#403528' },
          ].map((item) => (
            <div key={item.name} className="flex items-center gap-2.5 rounded-xl bg-[#f5f1e8]/5 p-2">
              <div className="h-10 w-10 rounded-lg" style={{ backgroundColor: item.tone }} />
              <div className="flex-1">
                <p className="text-[10px] font-semibold">{item.name}</p>
                <p className="text-[10px] font-bold text-gold">{item.price} BAM</p>
              </div>
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gold text-[#141210]">
                <span className="text-xs font-bold leading-none">+</span>
              </span>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between rounded-full bg-gold px-3.5 py-2.5 text-[#141210]">
          <span className="flex items-center gap-1.5 text-[10px] font-bold">
            <ShoppingBag className="h-3 w-3" />
            {td('order.table')}
          </span>
          <span className="text-[10px] font-bold">9.50 BAM</span>
        </div>
      </div>
    </PhoneFrame>
  );
}

function GalleryMockup() {
  const tones = ['#5b4a32', '#7a6242', '#403528', '#8a7048', '#33291d', '#6b5638', '#4d3f2c', '#95815e', '#584732'];
  const heights = [3.4, 4.6, 3.0, 4.2, 3.8, 3.2, 4.4, 3.6, 4.0];
  return (
    <PhoneFrame>
      <div className="p-4">
        <div className="text-center">
          <p className="font-display text-sm font-bold">Amina & Emir</p>
          <p className="text-[9px] uppercase tracking-[0.2em] text-gold">12. septembar 2026.</p>
        </div>
        <div className="mt-3 columns-2 gap-1.5">
          {tones.map((tone, i) => (
            <div key={i} className="mb-1.5 rounded-lg" style={{ backgroundColor: tone, height: `${heights[i]}rem` }} />
          ))}
        </div>
        <div className="mt-2 flex items-center justify-center gap-1.5 rounded-full border border-gold/40 py-2 text-[10px] font-bold text-gold">
          <Camera className="h-3 w-3" /> Dodaj uspomenu
        </div>
      </div>
    </PhoneFrame>
  );
}

function InviteMockup({ td }: { td: ReturnType<typeof useTranslations> }) {
  return (
    <PhoneFrame>
      <div className="relative p-4 pb-5 text-center">
        <div className="pointer-events-none absolute -top-10 left-1/2 h-32 w-48 -translate-x-1/2 rounded-full bg-gold/15 blur-2xl" />
        <p className="mt-2 text-[8px] uppercase tracking-[0.3em] text-[#f5f1e8]/40">
          Sa radošću vas pozivamo
        </p>
        <p className="mt-2 font-display text-xl font-bold">
          Amina <span className="text-gold">&</span> Emir
        </p>
        <p className="mt-1 text-[9px] uppercase tracking-[0.2em] text-[#f5f1e8]/45">
          Subota · 12.09.2026. · 17h
        </p>
        <div className="mx-auto mt-3 grid max-w-[13rem] grid-cols-4 gap-1">
          {['128', '14', '32', '08'].map((n, i) => (
            <div key={i} className="rounded-lg border border-gold/25 bg-gold/5 py-1.5">
              <p className="font-display text-sm font-bold text-gold">{n}</p>
              <p className="text-[7px] uppercase text-[#f5f1e8]/35">{['dana', 'sati', 'min', 'sek'][i]}</p>
            </div>
          ))}
        </div>
        <div className="mx-auto mt-3 flex max-w-[13rem] items-center justify-between rounded-xl bg-[#f5f1e8]/5 px-3 py-2">
          <span className="flex items-center gap-1.5 text-[9px] font-semibold">
            <Heart className="h-3 w-3 fill-gold text-gold" /> {td('rsvp.names')}
          </span>
          <span className="flex items-center gap-1 text-[9px] font-bold text-emerald-400">
            <Check className="h-2.5 w-2.5" /> {td('rsvp.reply')}
          </span>
        </div>
        <div className="mx-auto mt-2 max-w-[13rem] rounded-full bg-gold py-2 text-[10px] font-bold text-[#141210]">
          Potvrdi dolazak
        </div>
      </div>
    </PhoneFrame>
  );
}

function SeatingMockup() {
  const tables = [
    { n: '1', vip: false }, { n: '2', vip: false }, { n: '3', vip: true },
    { n: '4', vip: false }, { n: '5', vip: false }, { n: '6', vip: true },
    { n: '7', vip: false }, { n: '8', vip: false }, { n: '9', vip: false },
  ];
  return (
    <PhoneFrame>
      <div className="p-4">
        <div className="text-center">
          <p className="text-[9px] uppercase tracking-[0.25em] text-gold">Raspored sjedenja</p>
          <p className="mt-1 font-display text-sm font-bold">Amina & Emir</p>
        </div>
        <div className="mt-3 flex items-center gap-1.5 rounded-full bg-[#f5f1e8]/6 px-3 py-1.5">
          <span className="h-3 w-3 rounded-full border border-[#f5f1e8]/30" />
          <span className="text-[9px] text-[#f5f1e8]/40">Adnan Hodžić...</span>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-1.5">
          {tables.map((table) => (
            <div
              key={table.n}
              className={`flex flex-col items-center rounded-xl py-2.5 ${
                table.n === '5'
                  ? 'bg-gold text-[#141210]'
                  : table.vip
                    ? 'border border-gold/40 bg-gold/8'
                    : 'bg-[#f5f1e8]/6'
              }`}
            >
              <span className={`font-display text-sm font-bold ${table.n === '5' ? '' : table.vip ? 'text-gold' : ''}`}>
                {table.n}
              </span>
              {table.n === '5' && <span className="text-[7px] font-bold uppercase">Tvoj sto</span>}
              {table.vip && table.n !== '5' && <span className="text-[7px] uppercase text-gold/70">VIP</span>}
            </div>
          ))}
        </div>
      </div>
    </PhoneFrame>
  );
}

// ================================================================
// Brojevi — ogromne cifre
// ================================================================

function Numbers() {
  const t = useTranslations('landing.hero');
  const items = [
    { value: 50, suffix: '+', label: t('statEvents') },
    { value: 10000, suffix: '+', label: t('statMemories') },
    { value: 24, suffix: '/7', label: t('statSupport') },
  ];

  return (
    <section className="border-y border-[#f5f1e8]/6 px-6 py-24">
      <div className="mx-auto grid max-w-6xl gap-12 sm:grid-cols-3">
        {items.map((item, i) => (
          <BigNumber key={i} {...item} delay={i * 0.1} />
        ))}
      </div>
    </section>
  );
}

function BigNumber({
  value,
  suffix,
  label,
  delay,
}: {
  value: number;
  suffix: string;
  label: string;
  delay: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const start = performance.now();
    let raf: number;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / 2000);
      setDisplay(Math.round(value * (1 - Math.pow(1 - p, 4))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, value]);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, delay }}
      className="text-center sm:text-left"
    >
      <p className="font-display text-[clamp(3.5rem,7vw,6rem)] font-bold leading-none text-gold">
        {display.toLocaleString('bs-BA')}
        <span className="text-[0.5em] text-gold/60">{suffix}</span>
      </p>
      <p className="mt-3 text-xs uppercase tracking-[0.25em] text-[#f5f1e8]/40">{label}</p>
    </motion.div>
  );
}

// ================================================================
// Galerija — dvije marquee trake u suprotnim smjerovima
// ================================================================

function GalleryMarquee() {
  const t = useTranslations('landing.galleryStrip');
  const { data: images } = useQuery({
    queryKey: ['publicGallery'],
    queryFn: () => api<PublicImage[]>('/api/public/gallery'),
    staleTime: 60_000,
  });

  if (!images?.length) return null;

  const row1 = images.slice(0, Math.ceil(images.length / 2));
  const row2 = images.slice(Math.ceil(images.length / 2));
  if (!row2.length) row2.push(...row1);

  return (
    <section id="galerija" className="scroll-mt-20 overflow-hidden py-32">
      <div className="mx-auto mb-14 max-w-6xl px-6">
        <SectionLabel index="02" label={t('overline')} />
        <h2 className="mt-4 font-display text-4xl font-bold sm:text-6xl">{t('title')}</h2>
      </div>

      <div className="marquee-pause space-y-4">
        <MarqueeRow images={[...row1, ...row1, ...row1]} reverse={false} />
        <MarqueeRow images={[...row2, ...row2, ...row2]} reverse />
      </div>
    </section>
  );
}

function MarqueeRow({ images, reverse }: { images: PublicImage[]; reverse: boolean }) {
  return (
    <div className="overflow-hidden">
      <div className={`flex w-max gap-4 ${reverse ? 'animate-marquee-reverse' : 'animate-marquee-slow'}`}>
        {images.map((image, i) => (
          <div key={`${image.id}-${i}`} className="group relative h-52 shrink-0 overflow-hidden rounded-2xl sm:h-64">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl(image.thumbPath)!}
              alt={image.event.name}
              loading="lazy"
              className="h-full w-auto object-cover transition-transform duration-700 group-hover:scale-105"
              style={{ aspectRatio: `${image.width} / ${image.height}` }}
            />
            <div className="pointer-events-none absolute inset-0 flex items-end bg-gradient-to-t from-[#0c0b09]/70 to-transparent p-3.5 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
              <p className="flex items-center gap-1.5 text-xs font-medium">
                <Heart className="h-3 w-3 fill-gold text-gold" />
                {image.event.clientNames || image.event.name}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ================================================================
// Testimonijali
// ================================================================

function Testimonials() {
  const t = useTranslations('landing.testimonials');
  const quotes = [
    { text: t('q1'), author: t('q1a'), info: t('q1i') },
    { text: t('q2'), author: t('q2a'), info: t('q2i') },
    { text: t('q3'), author: t('q3a'), info: t('q3i') },
  ];
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setIndex((i) => (i + 1) % quotes.length), 6500);
    return () => clearInterval(timer);
  }, [quotes.length]);

  return (
    <section className="border-t border-[#f5f1e8]/6 px-6 py-32">
      <div className="mx-auto max-w-4xl">
        <SectionLabel index="03" label={t('overline')} />

        <div className="relative mt-12 min-h-[17rem] sm:min-h-[14rem]">
          <AnimatePresence mode="wait">
            <motion.figure
              key={index}
              initial={{ opacity: 0, y: 28 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -28 }}
              transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            >
              <blockquote className="font-display text-2xl font-semibold leading-snug text-[#f5f1e8]/90 sm:text-4xl">
                <span className="mr-2 text-gold">"</span>
                {quotes[index].text}
                <span className="ml-1 text-gold">"</span>
              </blockquote>
              <figcaption className="mt-8 flex items-center gap-4">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gold/12 font-display font-bold text-gold">
                  {quotes[index].author[0]}
                </span>
                <span>
                  <p className="font-semibold text-gold">{quotes[index].author}</p>
                  <p className="text-xs uppercase tracking-wider text-[#f5f1e8]/35">
                    {quotes[index].info}
                  </p>
                </span>
              </figcaption>
            </motion.figure>
          </AnimatePresence>
        </div>

        <div className="mt-10 flex gap-2">
          {quotes.map((_, i) => (
            <button key={i} onClick={() => setIndex(i)} className="group p-1" aria-label={`Testimonijal ${i + 1}`}>
              <span
                className={`block h-1.5 rounded-full transition-all duration-300 ${
                  i === index ? 'w-8 bg-gold' : 'w-1.5 bg-[#f5f1e8]/20 group-hover:bg-[#f5f1e8]/40'
                }`}
              />
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

// ================================================================
// FAQ
// ================================================================

function Faq() {
  const t = useTranslations('landing.faq');
  const [open, setOpen] = useState<number | null>(0);
  const items = [
    { q: t('q1'), a: t('a1') },
    { q: t('q2'), a: t('a2') },
    { q: t('q3'), a: t('a3') },
    { q: t('q4'), a: t('a4') },
  ];

  return (
    <section id="faq" className="scroll-mt-20 border-t border-[#f5f1e8]/6 px-6 py-32">
      <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[0.8fr_1.2fr]">
        <div>
          <SectionLabel index="04" label={t('overline')} />
          <h2 className="mt-4 font-display text-4xl font-bold sm:text-5xl">{t('title')}</h2>
        </div>

        <div className="space-y-3">
          {items.map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.5, delay: i * 0.06 }}
              className={`overflow-hidden rounded-2xl border transition-colors ${
                open === i ? 'border-gold/35 bg-[#f5f1e8]/[0.04]' : 'border-[#f5f1e8]/8 bg-[#f5f1e8]/[0.02]'
              }`}
            >
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="flex w-full items-center justify-between px-6 py-5 text-left"
              >
                <span className="pr-4 font-semibold">{item.q}</span>
                <motion.span animate={{ rotate: open === i ? 180 : 0 }} transition={{ duration: 0.25 }}>
                  <ChevronDown className="h-4 w-4 shrink-0 text-gold" />
                </motion.span>
              </button>
              <AnimatePresence initial={false}>
                {open === i && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: 'easeInOut' }}
                  >
                    <p className="px-6 pb-6 text-sm leading-relaxed text-[#f5f1e8]/50">{item.a}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ================================================================
// Finalni CTA + footer
// ================================================================

function FinalCta() {
  const t = useTranslations('landing.contact');
  const tn = useTranslations('landing.nav');
  const th = useTranslations('landing.hero');
  const tf = useTranslations('landing.footer');
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end end'] });
  const yGlow = useTransform(scrollYProgress, [0, 1], [80, 0]);
  const { data: galleryImages } = useQuery({
    queryKey: ['publicGallery'],
    queryFn: () => api<PublicImage[]>('/api/public/gallery'),
    staleTime: 60_000,
  });

  return (
    <section id="kontakt" ref={ref} className="relative scroll-mt-20 overflow-hidden border-t border-[#f5f1e8]/6">
      <motion.div style={{ y: yGlow }} className="pointer-events-none absolute inset-0">
        <div className="absolute bottom-[-14rem] left-1/2 h-[30rem] w-[64rem] -translate-x-1/2 rounded-full bg-gold/12 blur-3xl" />
      </motion.div>

      <div className="relative mx-auto max-w-6xl px-6 pb-12 pt-32 text-center">
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-xs uppercase tracking-[0.35em] text-gold"
        >
          {t('overline')}
        </motion.p>

        <motion.h2
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="mt-6 font-display text-[clamp(2.6rem,7vw,6.5rem)] font-bold leading-[1.02]"
        >
          {t('finalTitle1')}
          <br />
          <span className="italic text-gold">{t('finalTitle2')}</span>
        </motion.h2>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="mt-6 text-[#f5f1e8]/45"
        >
          {t('sub')}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="mt-10"
        >
          <a
            href={`tel:${CONTACT_PHONE.replaceAll(' ', '')}`}
            className="btn-glossy group inline-flex items-center gap-3 rounded-full bg-gold py-2.5 pl-8 pr-2.5 text-lg font-semibold text-[#141210]"
          >
            {t('call')} · {CONTACT_PHONE}
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#141210]/90 text-gold transition-transform duration-300 ease-out group-hover:rotate-[360deg]">
              <Phone className="h-4 w-4" />
            </span>
          </a>
          <p className="mt-7 text-xs text-[#f5f1e8]/25">{th('trustedBy')}</p>
        </motion.div>

        {/* Footer */}
        <div className="mt-28 flex flex-col items-center justify-between gap-6 border-t border-[#f5f1e8]/8 pt-8 text-left sm:flex-row">
          <div>
            <p className="font-display text-lg font-bold">
              Special Day<span className="text-gold">.</span>
            </p>
            <p className="mt-1 text-xs text-[#f5f1e8]/30">
              © {new Date().getFullYear()} — {tf('rights')}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-[#f5f1e8]/40">
            <a href="#proizvodi" className="transition-colors hover:text-gold">
              {tn('products')}
            </a>
            {!!galleryImages?.length && (
              <a href="#galerija" className="transition-colors hover:text-gold">
                {tn('gallery')}
              </a>
            )}
            <a href="#faq" className="transition-colors hover:text-gold">
              {tn('faq')}
            </a>
            <a
              href={`tel:${CONTACT_PHONE.replaceAll(' ', '')}`}
              className="flex items-center gap-1.5 transition-colors hover:text-gold"
            >
              <Phone className="h-3 w-3" /> {CONTACT_PHONE}
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

// ================================================================
// Pomoćne
// ================================================================

function SectionLabel({ index, label }: { index: string; label: string }) {
  return (
    <motion.p
      initial={{ opacity: 0, x: -20 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.3em] text-gold"
    >
      <span className="font-display text-sm">{index}</span>
      <span className="h-px w-10 bg-gold/50" />
      {label}
    </motion.p>
  );
}
