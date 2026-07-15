'use client';

import { use, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search,
  Star,
  ShoppingBag,
  Plus,
  Minus,
  X,
  Loader2,
  UtensilsCrossed,
  Coffee,
  Megaphone,
  Send,
  MapPin,
  Phone,
  Sparkles,
  Gift,
  ChevronRight,
} from 'lucide-react';
import { MENU_LANGS, MENU_LANG_META } from '@platform/shared';
import { useRouter } from '@/i18n/navigation';
import { api, ApiError } from '@/lib/api';
import { useCart } from '@/lib/cart';
import { WheelOfFortune } from '@/components/menu/WheelOfFortune';
import { ReviewModal } from '@/components/menu/ReviewModal';
import {
  type PublicMenu,
  type MenuCategoryRow,
  type MenuItemRow,
  imageUrl,
  finalPrice,
  fmtPrice,
} from '@/lib/menuTypes';

type PublicMenuFull = PublicMenu & { googleReviewUrl?: string | null };

const GROUP_META = {
  promo: { label: 'Promo', icon: Megaphone },
  food: { label: 'Hrana', icon: UtensilsCrossed },
  drink: { label: 'Pića', icon: Coffee },
} as const;
type GroupKey = keyof typeof GROUP_META;

/** Dijakritički-neosjetljiva pretraga */
const normalize = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');

export default function PublicMenuPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const router = useRouter();

  const { data: menu, isLoading, error } = useQuery({
    queryKey: ['publicMenu', slug],
    queryFn: () => api<PublicMenuFull>(`/api/public/venues/${slug}/menu`),
    staleTime: 60_000,
  });

  const cart = useCart();
  const [search, setSearch] = useState('');
  const [activeGroup, setActiveGroup] = useState<GroupKey | null>(null);
  const [activeSection, setActiveSection] = useState<string>('');
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [wheelOpen, setWheelOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [lang, setLang] = useState<string>(''); // '' dok se ne učita defaultLang
  // osvojena nagrada na kolu sreće (perzistira 1h)
  const [wheelWon, setWheelWon] = useState<{ itemId: number; pct: number } | null>(null);
  const mainRef = useRef<HTMLDivElement>(null);

  // Tema
  const theme = menu?.theme ?? {};
  const primary = theme.primaryColor ?? '#d4af37';
  const bgImage = theme.backgroundImagePath ? imageUrl(theme.backgroundImagePath) : null;

  // Postavi početni jezik: zapamćeni izbor gosta, inače defaultLang objekta
  useEffect(() => {
    if (!menu || lang) return;
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(`sd_lang_${slug}`);
    } catch {}
    setLang(stored || menu.defaultLang || 'bs');
  }, [menu, lang, slug]);

  // Prvi put (po lokalu): ako ima >1 jezik i nije birano → prikaži izbor jezika
  const [langGateChecked, setLangGateChecked] = useState(false);
  const [showLangGate, setShowLangGate] = useState(false);

  const chooseLang = (l: string) => {
    setLang(l);
    try {
      localStorage.setItem(`sd_lang_${slug}`, l);
    } catch {}
    setShowLangGate(false);
  };

  // Jezici za koje POSTOJI barem jedan prevod (+ uvijek osnovni bs)
  const availableLangs = useMemo(() => {
    const set = new Set<string>(['bs']);
    menu?.categories.forEach((c) => {
      c.translations?.forEach((t) => set.add(t.lang));
      c.items.forEach((i) => i.translations?.forEach((t) => set.add(t.lang)));
    });
    return MENU_LANGS.filter((l) => set.has(l));
  }, [menu]);

  useEffect(() => {
    if (!menu || langGateChecked || availableLangs.length <= 1) return;
    setLangGateChecked(true);
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(`sd_lang_${slug}`);
    } catch {}
    if (!stored) setShowLangGate(true);
  }, [menu, availableLangs, langGateChecked, slug]);

  // Kategorije s primijenjenim prevodom za odabrani jezik (fallback na osnovni tekst)
  const tCategories = useMemo(() => {
    if (!menu) return [] as MenuCategoryRow[];
    return menu.categories.map((c) => {
      const ct = c.translations?.find((t) => t.lang === lang);
      return {
        ...c,
        name: ct?.name || c.name,
        items: c.items.map((i) => {
          const it = i.translations?.find((t) => t.lang === lang);
          return it
            ? { ...i, name: it.name || i.name, description: it.description ?? null }
            : i;
        }),
      };
    });
  }, [menu, lang]);

  const featured = useMemo(
    () => tCategories.flatMap((c) => c.items.filter((i) => i.isFeatured)),
    [tCategories]
  );

  // Kolo sreće: automatski otvori jednom po satu ako je uključeno i ima nagrada
  useEffect(() => {
    if (!menu?.wheelEnabled || !menu.wheelPercentage || featured.length === 0) return;
    // već osvojeno (u zadnjih sat) → učitaj nagradu, ne otvaraj ponovo
    try {
      const saved = localStorage.getItem(`sd_wheel_${slug}`);
      if (saved) {
        const { itemId, pct, exp } = JSON.parse(saved);
        if (exp > Date.now()) {
          setWheelWon({ itemId, pct });
          return;
        }
      }
    } catch {}
    const spun = localStorage.getItem(`sd_wheel_spun_${slug}`);
    if (spun && Date.now() - Number(spun) < 3600_000) return;
    const t = setTimeout(() => setWheelOpen(true), 1200);
    return () => clearTimeout(t);
  }, [menu?.wheelEnabled, menu?.wheelPercentage, featured.length, slug]);

  const handleWheelWin = (item: MenuItemRow) => {
    const pct = menu?.wheelPercentage ?? 0;
    setWheelWon({ itemId: item.id, pct });
    const exp = Date.now() + 3600_000;
    try {
      localStorage.setItem(`sd_wheel_${slug}`, JSON.stringify({ itemId: item.id, pct, exp }));
      localStorage.setItem(`sd_wheel_spun_${slug}`, String(Date.now()));
    } catch {}
  };

  // Grupe koje stvarno postoje u meniju
  const groups = useMemo(() => {
    if (!menu) return [] as GroupKey[];
    const present = new Set(menu.categories.map((c) => c.kind));
    return (['promo', 'food', 'drink'] as GroupKey[]).filter((g) => present.has(g));
  }, [menu]);

  useEffect(() => {
    if (!activeGroup && groups.length) setActiveGroup(groups.includes('food') ? 'food' : groups[0]);
  }, [groups, activeGroup]);

  // Kategorije aktivne grupe + filter pretrage
  const visibleCategories = useMemo(() => {
    if (!menu) return [];
    let cats = tCategories;
    if (!search.trim() && activeGroup) cats = cats.filter((c) => c.kind === activeGroup);
    if (search.trim()) {
      const q = normalize(search);
      cats = cats
        .map((c) => ({
          ...c,
          items: c.items.filter(
            (i) => normalize(i.name).includes(q) || normalize(i.description ?? '').includes(q)
          ),
        }))
        .filter((c) => c.items.length > 0);
    }
    return cats;
  }, [menu, tCategories, search, activeGroup]);

  const showFeatured = featured.length > 0 && !search && activeGroup !== 'drink';

  // Scrollspy — aktivna kategorija u sidebaru prati scroll
  useEffect(() => {
    const sections = document.querySelectorAll('[data-menu-section]');
    if (!sections.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
            break;
          }
        }
      },
      { rootMargin: '-20% 0px -70% 0px' }
    );
    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, [visibleCategories, showFeatured]);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0c0b09]">
        <Loader2 className="h-7 w-7 animate-spin" style={{ color: primary }} />
      </main>
    );
  }

  if (error || !menu) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#0c0b09] px-6 text-center text-cream">
        <p className="font-display text-2xl font-bold">Meni nije pronađen</p>
        <p className="text-sm opacity-50">Provjerite da ste skenirali ispravan QR kod.</p>
      </main>
    );
  }

  const count = cart.venueSlug === slug ? cart.count() : 0;
  // Naručivanje isključeno → meni „samo za pregled" (bez korpe, dugmadi, kola sreće)
  const ordering = menu.orderingEnabled !== false;

  return (
    <main className="relative min-h-screen bg-[#0c0b09] text-[#f5f1e8]">
      {/* Prvi put: izbor jezika menija */}
      <LangGate
        open={showLangGate}
        langs={availableLangs}
        primary={primary}
        venueName={menu.name}
        logoPath={menu.logoPath}
        onPick={chooseLang}
        onClose={() => chooseLang(menu.defaultLang || 'bs')}
      />

      {/* Fiksna pozadinska slika sa overlay-em */}
      <div className="fixed inset-0 z-0">
        {bgImage ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={bgImage} alt="" className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-b from-[#0c0b09]/82 via-[#0c0b09]/88 to-[#0c0b09]/96" />
          </>
        ) : (
          <div className="absolute inset-0">
            <div
              className="absolute -top-40 left-1/3 h-[34rem] w-[34rem] rounded-full opacity-[0.07] blur-3xl"
              style={{ backgroundColor: primary }}
            />
            <div
              className="absolute bottom-0 right-0 h-96 w-96 rounded-full opacity-[0.05] blur-3xl"
              style={{ backgroundColor: primary }}
            />
          </div>
        )}
      </div>

      <div className="relative z-10 lg:flex">
        {/* ============ SIDEBAR (desktop) ============ */}
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 flex-col border-r border-white/8 bg-[#0c0b09]/72 backdrop-blur-2xl lg:flex">
          <div className="flex flex-col items-center px-6 pb-5 pt-8 text-center">
            {menu.logoPath ? (
              <motion.img
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
                src={imageUrl(menu.logoPath)!}
                alt={menu.name}
                className="h-24 w-24 rounded-2xl object-cover shadow-lifted ring-1 ring-white/10"
              />
            ) : (
              <div
                className="flex h-24 w-24 items-center justify-center rounded-2xl font-display text-3xl font-bold"
                style={{ backgroundColor: `${primary}22`, color: primary }}
              >
                {menu.name[0]}
              </div>
            )}
            <h1 className="mt-4 font-display text-xl font-bold leading-tight">{menu.name}</h1>
            {menu.address && (
              <p className="mt-1 flex items-center gap-1 text-[11px] opacity-45">
                <MapPin className="h-3 w-3" /> {menu.address}
              </p>
            )}
            {menu.googleReviewUrl && (
              <button
                onClick={() => setReviewOpen(true)}
                className="btn-glossy mt-4 flex w-full items-center justify-center gap-2 rounded-full py-2.5 text-xs font-bold uppercase tracking-wider text-[#0c0b09]"
                style={{ backgroundColor: primary }}
              >
                <Star className="h-3.5 w-3.5" style={{ fill: '#0c0b09' }} />
                Ostavite recenziju
              </button>
            )}
          </div>

          {/* Group tabovi */}
          {groups.length > 1 && (
            <div className="mx-5 mb-4 flex gap-1 rounded-full border border-white/10 bg-white/[0.04] p-1">
              {groups.map((group) => {
                const Icon = GROUP_META[group].icon;
                const active = activeGroup === group;
                return (
                  <button
                    key={group}
                    onClick={() => {
                      setActiveGroup(group);
                      setSearch('');
                      mainRef.current?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="relative flex flex-1 items-center justify-center gap-1.5 rounded-full py-2 text-[11px] font-semibold uppercase tracking-wide transition-colors"
                    style={{ color: active ? '#0c0b09' : 'rgba(245,241,232,0.55)' }}
                  >
                    {active && (
                      <motion.span
                        layoutId="group-pill"
                        className="absolute inset-0 rounded-full"
                        style={{ backgroundColor: primary }}
                        transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                      />
                    )}
                    <Icon className="relative h-3.5 w-3.5" />
                    <span className="relative">{GROUP_META[group].label}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Kategorije — scrollspy nav */}
          <nav className="scrollbar-none flex-1 space-y-1 overflow-y-auto px-4 pb-4">
            {showFeatured && (
              <SidebarLink
                id="section-featured"
                label="Specijalna ponuda"
                count={featured.length}
                icon={Star}
                active={activeSection === 'section-featured'}
                primary={primary}
                onClick={() => scrollTo('section-featured')}
              />
            )}
            {visibleCategories.map((category) => (
              <SidebarLink
                key={category.id}
                id={`section-${category.id}`}
                label={category.name}
                count={category.items.length}
                icon={GROUP_META[category.kind].icon}
                active={activeSection === `section-${category.id}`}
                primary={primary}
                onClick={() => scrollTo(`section-${category.id}`)}
              />
            ))}
          </nav>

          {/* Footer sidebara */}
          <div className="space-y-3 border-t border-white/8 px-5 py-5">
            {menu.phone && (
              <a
                href={`tel:${menu.phone}`}
                className="flex items-center justify-center gap-2 text-xs opacity-45 transition-opacity hover:opacity-90"
              >
                <Phone className="h-3 w-3" /> {menu.phone}
              </a>
            )}
            <p className="text-center text-[10px] uppercase tracking-[0.2em] opacity-25">
              Special Day<span style={{ color: primary }}>.</span>
            </p>
          </div>
        </aside>

        {/* ============ GLAVNI SADRŽAJ ============ */}
        <div ref={mainRef} className="min-h-screen flex-1 lg:ml-72">
          {/* Mobile hero */}
          <header className="relative px-5 pb-2 pt-10 text-center lg:hidden">
            <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }}>
              {menu.logoPath && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imageUrl(menu.logoPath)!}
                  alt={menu.name}
                  className="mx-auto mb-4 h-20 w-20 rounded-2xl object-cover shadow-lifted ring-1 ring-white/10"
                />
              )}
              <h1 className="font-display text-3xl font-bold">{menu.name}</h1>
              {menu.address && (
                <p className="mt-1 flex items-center justify-center gap-1 text-xs opacity-45">
                  <MapPin className="h-3 w-3" /> {menu.address}
                </p>
              )}
              {menu.googleReviewUrl && (
                <button
                  onClick={() => setReviewOpen(true)}
                  className="btn-glossy mx-auto mt-4 flex items-center gap-2 rounded-full px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-[#0c0b09]"
                  style={{ backgroundColor: primary }}
                >
                  <Star className="h-3.5 w-3.5" style={{ fill: '#0c0b09' }} />
                  Ostavite recenziju
                </button>
              )}
            </motion.div>
          </header>

          {/* Sticky pretraga (+ mobile grupe/kategorije) */}
          <div className="sticky top-0 z-30 border-b border-white/8 bg-[#0c0b09]/78 px-4 pb-3 pt-3 backdrop-blur-xl lg:px-10">
            <div className="mx-auto flex max-w-[1600px] items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 opacity-35" />
                <input
                  placeholder="Pretraži meni..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-full border border-white/12 bg-white/[0.05] py-2.5 pl-11 pr-10 text-sm outline-none transition-all placeholder:text-[#f5f1e8]/30 focus:border-white/25 focus:bg-white/[0.08]"
                />
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 opacity-40 hover:opacity-100"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {availableLangs.length > 1 && (
                <LangSelect lang={lang} setLang={chooseLang} langs={availableLangs} primary={primary} />
              )}
            </div>

            {/* Mobile: grupe + kategorije pillovi */}
            {!search && (
              <div className="mt-3 space-y-2 lg:hidden">
                {groups.length > 1 && (
                  <div className="flex gap-1 rounded-full border border-white/10 bg-white/[0.04] p-1">
                    {groups.map((group) => {
                      const Icon = GROUP_META[group].icon;
                      const active = activeGroup === group;
                      return (
                        <button
                          key={group}
                          onClick={() => setActiveGroup(group)}
                          className="relative flex flex-1 items-center justify-center gap-1.5 rounded-full py-2 text-[11px] font-semibold uppercase tracking-wide"
                          style={{ color: active ? '#0c0b09' : 'rgba(245,241,232,0.55)' }}
                        >
                          {active && (
                            <motion.span
                              layoutId="group-pill-m"
                              className="absolute inset-0 rounded-full"
                              style={{ backgroundColor: primary }}
                              transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                            />
                          )}
                          <Icon className="relative h-3.5 w-3.5" />
                          <span className="relative">{GROUP_META[group].label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
                <div className="scrollbar-none flex gap-2 overflow-x-auto pb-0.5">
                  {showFeatured && (
                    <MobilePill
                      label="Specijalna ponuda"
                      active={activeSection === 'section-featured'}
                      primary={primary}
                      onClick={() => scrollTo('section-featured')}
                    />
                  )}
                  {visibleCategories.map((c) => (
                    <MobilePill
                      key={c.id}
                      label={c.name}
                      active={activeSection === `section-${c.id}`}
                      primary={primary}
                      onClick={() => scrollTo(`section-${c.id}`)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sekcije */}
          <div className="mx-auto max-w-[1600px] px-4 pb-32 lg:px-10">
            {/* Promo baner */}
            {menu.promoImagePath && !search && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="relative mt-6 overflow-hidden rounded-3xl border border-white/10 shadow-lifted"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageUrl(menu.promoImagePath)!}
                  alt={menu.promoCaption ?? 'Promocija'}
                  className="max-h-72 w-full object-cover"
                />
                {menu.promoCaption && (
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-5">
                    <p className="font-display text-lg font-bold text-white">{menu.promoCaption}</p>
                  </div>
                )}
              </motion.div>
            )}

            {showFeatured && (
              <MenuSection
                id="section-featured"
                title="Specijalna ponuda"
                icon={<Sparkles className="h-5 w-5" style={{ color: primary }} />}
                items={featured}
                currency={menu.currency}
                primary={primary}
                highlight
                ordering={ordering}
                wheelWon={wheelWon}
                onAdd={(item) =>
                  cart.add(slug, {
                    itemId: item.id,
                    name: item.name,
                    unitPrice: finalPrice(item.price, item.discountPercent),
                    imagePath: item.imagePath,
                  })
                }
              />
            )}

            {visibleCategories.map((category) => (
              <MenuSection
                key={category.id}
                id={`section-${category.id}`}
                title={category.name}
                items={category.items}
                currency={menu.currency}
                primary={primary}
                compact={category.kind === 'drink'}
                ordering={ordering}
                wheelWon={wheelWon}
                onAdd={(item) =>
                  cart.add(slug, {
                    itemId: item.id,
                    name: item.name,
                    unitPrice: finalPrice(item.price, item.discountPercent),
                    imagePath: item.imagePath,
                  })
                }
              />
            ))}

            {search && visibleCategories.length === 0 && (
              <p className="py-20 text-center text-sm opacity-40">Nema rezultata za "{search}".</p>
            )}

            {/* Mobile footer */}
            <footer className="mt-14 border-t border-white/8 pt-6 text-center lg:hidden">
              {menu.phone && (
                <a href={`tel:${menu.phone}`} className="flex items-center justify-center gap-2 text-sm opacity-50">
                  <Phone className="h-3.5 w-3.5" /> {menu.phone}
                </a>
              )}
              <p className="mt-4 text-[10px] uppercase tracking-[0.2em] opacity-25">
                Special Day<span style={{ color: primary }}>.</span>
              </p>
            </footer>
          </div>
        </div>
      </div>

      {/* Korpa FAB */}
      <AnimatePresence>
        {ordering && count > 0 && (
          <motion.button
            initial={{ y: 90, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 90, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            onClick={() => setCartOpen(true)}
            className="btn-glossy fixed bottom-5 left-1/2 z-40 flex w-[calc(100%-2.5rem)] max-w-md -translate-x-1/2 items-center justify-between rounded-full px-6 py-4 font-semibold text-[#0c0b09] lg:left-[calc(50%+9rem)]"
            style={{ backgroundColor: primary }}
          >
            <span className="flex items-center gap-2.5">
              <ShoppingBag className="h-5 w-5" />
              <motion.span
                key={count}
                initial={{ scale: 1.5 }}
                animate={{ scale: 1 }}
                className="rounded-full bg-[#0c0b09]/20 px-2 py-0.5 text-xs font-bold"
              >
                {count}
              </motion.span>
              Pregled narudžbe
            </span>
            <span>{fmtPrice(cart.total(), menu.currency)}</span>
          </motion.button>
        )}
      </AnimatePresence>

      <CartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        onCheckout={() => {
          setCartOpen(false);
          setCheckoutOpen(true);
        }}
        currency={menu.currency}
        primary={primary}
      />
      <CheckoutSheet
        open={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        slug={slug}
        currency={menu.currency}
        primary={primary}
        wheelItemId={wheelWon?.itemId ?? null}
        onSuccess={(publicId) => {
          cart.clear();
          router.push(`/m/${slug}/order/${publicId}`);
        }}
      />

      {/* Kolo sreće — floating trigger (ako uključeno, ima nagrada, još nije osvojeno) */}
      {ordering && menu.wheelEnabled && !!menu.wheelPercentage && featured.length > 0 && !wheelWon && !wheelOpen && (
        <motion.button
          initial={{ scale: 0, rotate: -30 }}
          animate={{ scale: 1, rotate: 0 }}
          onClick={() => setWheelOpen(true)}
          className="fixed bottom-24 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full text-[#14110d] shadow-lifted lg:bottom-5"
          style={{ backgroundColor: primary }}
          aria-label="Kolo sreće"
          title="Kolo sreće — osvoji popust!"
        >
          <motion.span animate={{ rotate: [0, 360] }} transition={{ repeat: Infinity, duration: 8, ease: 'linear' }}>
            <Gift className="h-6 w-6" />
          </motion.span>
        </motion.button>
      )}

      <AnimatePresence>
        {wheelOpen && (
          <WheelOfFortune
            prizes={featured}
            fillerNames={menu.categories.flatMap((c) => c.items.map((i) => i.name))}
            percentage={menu.wheelPercentage ?? 0}
            currency={menu.currency}
            primary={primary}
            onClose={() => setWheelOpen(false)}
            onWin={handleWheelWin}
          />
        )}
        {reviewOpen && (
          <ReviewModal
            slug={slug}
            name={menu.name}
            googleReviewUrl={menu.googleReviewUrl}
            reviewGateEnabled={menu.reviewGateEnabled}
            primary={primary}
            onClose={() => setReviewOpen(false)}
          />
        )}
      </AnimatePresence>
    </main>
  );
}

// ================================================================
// Sidebar / pill komponente
// ================================================================

function SidebarLink({
  id,
  label,
  count,
  icon: Icon,
  active,
  primary,
  onClick,
}: {
  id: string;
  label: string;
  count: number;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  active: boolean;
  primary: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group relative flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-left transition-colors hover:bg-white/[0.05]"
    >
      {active && (
        <motion.span
          layoutId="sidebar-active"
          className="absolute inset-0 rounded-xl"
          style={{ backgroundColor: `${primary}1a`, boxShadow: `inset 2px 0 0 ${primary}` }}
          transition={{ type: 'spring', stiffness: 400, damping: 34 }}
        />
      )}
      <Icon
        className="relative h-4 w-4 shrink-0 transition-colors"
        style={{ color: active ? primary : 'rgba(245,241,232,0.35)' }}
      />
      <span
        className="relative flex-1 truncate text-[13px] font-medium uppercase tracking-wide transition-colors"
        style={{ color: active ? '#f5f1e8' : 'rgba(245,241,232,0.6)' }}
      >
        {label}
      </span>
      <span className="relative rounded-full bg-white/8 px-1.5 py-0.5 text-[10px] font-semibold opacity-50">
        {count}
      </span>
    </button>
  );
}

function MobilePill({
  label,
  active,
  primary,
  onClick,
}: {
  label: string;
  active: boolean;
  primary: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all"
      style={
        active
          ? { backgroundColor: primary, borderColor: primary, color: '#0c0b09' }
          : { borderColor: 'rgba(245,241,232,0.15)', color: 'rgba(245,241,232,0.6)' }
      }
    >
      {label}
    </button>
  );
}

// ================================================================
// Sekcija + kartice jela
// ================================================================

function MenuSection({
  id,
  title,
  icon,
  items,
  currency,
  primary,
  highlight,
  compact,
  ordering = true,
  wheelWon,
  onAdd,
}: {
  id: string;
  title: string;
  icon?: React.ReactNode;
  items: MenuItemRow[];
  currency: string;
  primary: string;
  highlight?: boolean;
  compact?: boolean; // pića → kompaktne kartice sa malom sličicom
  ordering?: boolean; // false → bez dugmadi za dodavanje (meni samo za pregled)
  wheelWon?: { itemId: number; pct: number } | null;
  onAdd: (item: MenuItemRow) => void;
}) {
  // primijeni osvojeni popust sa kola sreće na taj artikal (bolji od postojećeg)
  const withWheel = (i: MenuItemRow): MenuItemRow =>
    wheelWon && wheelWon.itemId === i.id
      ? { ...i, discountPercent: Math.max(i.discountPercent ?? 0, wheelWon.pct) }
      : i;
  const shown = items.map(withWheel);
  // Za pića: sve kompaktno (mala sličica). Za hranu: velike kartice sa slikom.
  const withImages = compact ? [] : shown.filter((i) => i.imagePath);
  const compactItems = compact ? shown : shown.filter((i) => !i.imagePath);

  return (
    <section id={id} data-menu-section className="scroll-mt-36 pt-10">
      <div className="mb-5 flex items-center gap-2.5">
        {icon}
        <h2 className="font-display text-2xl font-bold tracking-tight">{title}</h2>
        <div
          className="ml-2 h-px flex-1"
          style={{
            background: `linear-gradient(to right, ${highlight ? primary : 'rgba(245,241,232,0.12)'}, transparent)`,
          }}
        />
      </div>

      {/* Kartice sa slikama — veliki vizuali (samo hrana) */}
      {withImages.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {withImages.map((item) => (
            <ImageCard key={item.id} item={item} currency={currency} primary={primary} ordering={ordering} onAdd={() => onAdd(item)} />
          ))}
        </div>
      )}

      {/* Kompaktne kartice (pića uvijek; hrana bez slike) */}
      {compactItems.length > 0 && (
        <div className={`grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 ${withImages.length > 0 ? 'mt-4' : ''}`}>
          {compactItems.map((item) => (
            <CompactCard key={item.id} item={item} currency={currency} primary={primary} ordering={ordering} onAdd={() => onAdd(item)} />
          ))}
        </div>
      )}
    </section>
  );
}

function PriceTag({ item, currency, primary }: { item: MenuItemRow; currency: string; primary: string }) {
  const price = finalPrice(item.price, item.discountPercent);
  if (item.discountPercent) {
    return (
      <span className="flex items-center gap-1.5">
        <span className="text-xs line-through opacity-40">{parseFloat(item.price).toFixed(2)}</span>
        <span className="font-display text-lg font-bold" style={{ color: primary }}>
          {price.toFixed(2)}
        </span>
        <span className="text-[10px] font-semibold uppercase opacity-50">{currency}</span>
      </span>
    );
  }
  return (
    <span className="flex items-baseline gap-1">
      <span className="font-display text-lg font-bold" style={{ color: primary }}>
        {price.toFixed(2)}
      </span>
      <span className="text-[10px] font-semibold uppercase opacity-50">{currency}</span>
    </span>
  );
}

// Jezik → ISO kod države za zastavicu (emoji zastave ne rade na Windowsu)
const FLAG_CC: Record<string, string> = {
  bs: 'ba',
  en: 'gb',
  de: 'de',
  it: 'it',
  es: 'es',
  fr: 'fr',
  tr: 'tr',
  ar: 'sa',
};

function Flag({ lang, className }: { lang: string; className?: string }) {
  const cc = FLAG_CC[lang] ?? 'un';
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={`https://flagcdn.com/${cc}.svg`} alt="" loading="lazy" className={className} />
  );
}

function LangGate({
  open,
  langs,
  primary,
  venueName,
  logoPath,
  onPick,
  onClose,
}: {
  open: boolean;
  langs: readonly string[];
  primary: string;
  venueName: string;
  logoPath: string | null;
  onPick: (l: string) => void;
  onClose: () => void;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-[#0c0b09]/95 px-5 py-10 backdrop-blur-md sm:items-center"
        >
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 300, damping: 26 }}
            className="w-full max-w-[22rem]"
          >
            {/* Zaglavlje */}
            <div className="mb-7 text-center">
              {logoPath ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imageUrl(logoPath)!}
                  alt={venueName}
                  className="mx-auto mb-4 h-20 w-20 rounded-3xl object-cover shadow-lifted ring-1 ring-white/10"
                />
              ) : (
                <div
                  className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-3xl font-display text-3xl font-bold ring-1 ring-white/10"
                  style={{ background: `${primary}22`, color: primary }}
                >
                  {venueName[0]}
                </div>
              )}
              <h2 className="font-display text-2xl font-bold">{venueName}</h2>
              <div className="mt-2 flex items-center justify-center gap-2">
                <span className="h-px w-6" style={{ background: `${primary}88` }} />
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em]" style={{ color: primary }}>
                  Odaberite jezik
                </p>
                <span className="h-px w-6" style={{ background: `${primary}88` }} />
              </div>
              <p className="mt-1 text-xs opacity-40">Choose your language</p>
            </div>

            {/* Jezici — jedan ispod drugog */}
            <div className="space-y-2">
              {langs.map((l, i) => {
                const meta = MENU_LANG_META[l as keyof typeof MENU_LANG_META];
                return (
                  <motion.button
                    key={l}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.05 + i * 0.05, duration: 0.35 }}
                    onClick={() => onPick(l)}
                    className="group flex w-full items-center gap-3.5 rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3.5 text-left transition-all hover:bg-white/[0.07]"
                    style={{ borderColor: 'rgba(255,255,255,0.1)' }}
                    onMouseEnter={(e) => (e.currentTarget.style.borderColor = `${primary}88`)}
                    onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)')}
                  >
                    <span className="h-8 w-11 shrink-0 overflow-hidden rounded-md shadow-soft ring-1 ring-white/12">
                      <Flag lang={l} className="h-full w-full object-cover" />
                    </span>
                    <span className="flex-1">
                      <span className="block text-[15px] font-semibold leading-tight">{meta.label}</span>
                      <span className="block text-[10px] uppercase tracking-widest opacity-35">{l}</span>
                    </span>
                    <ChevronRight
                      className="h-4 w-4 shrink-0 -translate-x-1 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100"
                      style={{ color: primary }}
                    />
                  </motion.button>
                );
              })}
            </div>

            <button
              onClick={onClose}
              className="mt-6 block w-full text-center text-xs uppercase tracking-[0.2em] opacity-40 transition-opacity hover:opacity-80"
            >
              Preskoči
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function LangSelect({
  lang,
  setLang,
  langs,
  primary,
}: {
  lang: string;
  setLang: (l: string) => void;
  langs: readonly string[];
  primary: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative shrink-0">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.05] px-3 py-2.5 text-sm outline-none transition-colors hover:bg-white/[0.09]"
        aria-label="Jezik menija"
      >
        <Flag lang={lang || 'bs'} className="h-4 w-6 rounded-sm object-cover ring-1 ring-white/10" />
        <span className="hidden text-xs font-semibold uppercase sm:inline">{lang || 'bs'}</span>
      </button>
      <AnimatePresence>
        {open && (
          <>
            <button className="fixed inset-0 z-40 cursor-default" onClick={() => setOpen(false)} aria-hidden />
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.97 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 z-50 mt-2 w-44 overflow-hidden rounded-2xl border border-white/12 bg-[#141210] p-1 shadow-lifted"
            >
              {langs.map((l) => {
                const meta = MENU_LANG_META[l as keyof typeof MENU_LANG_META];
                const active = (lang || 'bs') === l;
                return (
                  <button
                    key={l}
                    onClick={() => {
                      setLang(l);
                      setOpen(false);
                    }}
                    className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm transition-colors hover:bg-white/8"
                    style={active ? { color: primary } : undefined}
                  >
                    <Flag lang={l} className="h-4 w-6 rounded-sm object-cover ring-1 ring-white/10" />
                    <span className="flex-1">{meta.label}</span>
                    {active && <span className="text-xs">✓</span>}
                  </button>
                );
              })}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function AddButton({ primary, onAdd, small }: { primary: string; onAdd: () => void; small?: boolean }) {
  const [added, setAdded] = useState(false);
  return (
    <motion.button
      whileTap={{ scale: 0.82 }}
      animate={added ? { scale: [1, 1.28, 1] } : {}}
      onClick={(e) => {
        e.stopPropagation();
        onAdd();
        setAdded(true);
        setTimeout(() => setAdded(false), 450);
      }}
      className={`flex shrink-0 btn-glossy items-center justify-center rounded-full font-bold text-[#0c0b09] ${small ? 'h-8 w-8' : 'h-10 w-10'}`}
      style={{ backgroundColor: primary }}
      aria-label="Dodaj u narudžbu"
    >
      <Plus className={small ? 'h-4 w-4' : 'h-5 w-5'} />
    </motion.button>
  );
}

function ImageCard({
  item,
  currency,
  primary,
  ordering = true,
  onAdd,
}: {
  item: MenuItemRow;
  currency: string;
  primary: string;
  ordering?: boolean;
  onAdd: () => void;
}) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      whileHover={{ y: -4 }}
      className="group overflow-hidden rounded-2xl border border-white/8 bg-white/[0.045] backdrop-blur-sm transition-colors hover:border-white/16"
    >
      <div className="relative aspect-[16/10] overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl(item.imagePath)!}
          alt={item.name}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.06]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0c0b09]/55 via-transparent to-transparent" />
        {item.discountPercent && (
          <span
            className="absolute left-3 top-3 rounded-full px-2.5 py-1 text-[11px] font-bold text-[#0c0b09] shadow-soft"
            style={{ backgroundColor: primary }}
          >
            -{item.discountPercent}%
          </span>
        )}
        {item.isFeatured && (
          <span className="absolute right-3 top-3 rounded-full bg-[#0c0b09]/60 p-1.5 backdrop-blur">
            <Star className="h-3.5 w-3.5" style={{ color: primary, fill: primary }} />
          </span>
        )}
      </div>
      <div className="flex items-start justify-between gap-3 p-4">
        <div className="min-w-0">
          <h3 className="font-semibold leading-snug">{item.name}</h3>
          {item.description && (
            <p className="mt-1 line-clamp-2 text-xs leading-relaxed opacity-45">{item.description}</p>
          )}
          <div className="mt-2.5">
            <PriceTag item={item} currency={currency} primary={primary} />
          </div>
        </div>
        {ordering && (
          <div className="pt-0.5">
            <AddButton primary={primary} onAdd={onAdd} />
          </div>
        )}
      </div>
    </motion.article>
  );
}

function CompactCard({
  item,
  currency,
  primary,
  ordering = true,
  onAdd,
}: {
  item: MenuItemRow;
  currency: string;
  primary: string;
  ordering?: boolean;
  onAdd: () => void;
}) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-30px' }}
      transition={{ duration: 0.4 }}
      className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.045] p-3 backdrop-blur-sm transition-colors hover:border-white/16"
    >
      {item.imagePath && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl(item.imagePath)!}
          alt={item.name}
          loading="lazy"
          className="h-14 w-14 shrink-0 rounded-xl object-cover"
        />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <h3 className="truncate text-sm font-semibold">{item.name}</h3>
          {item.isFeatured && (
            <Star className="h-3 w-3 shrink-0" style={{ color: primary, fill: primary }} />
          )}
          {item.discountPercent && (
            <span
              className="shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold text-[#0c0b09]"
              style={{ backgroundColor: primary }}
            >
              -{item.discountPercent}%
            </span>
          )}
        </div>
        {item.description && (
          <p className="mt-0.5 line-clamp-1 text-xs opacity-45">{item.description}</p>
        )}
        <div className="mt-1.5">
          <PriceTag item={item} currency={currency} primary={primary} />
        </div>
      </div>
      {ordering && <AddButton primary={primary} onAdd={onAdd} small />}
    </motion.article>
  );
}

// ================================================================
// Korpa
// ================================================================

function CartDrawer({
  open,
  onClose,
  onCheckout,
  currency,
  primary,
}: {
  open: boolean;
  onClose: () => void;
  onCheckout: () => void;
  currency: string;
  primary: string;
}) {
  const cart = useCart();

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 36 }}
            className="fixed inset-x-0 bottom-0 z-50 max-h-[80vh] overflow-y-auto rounded-t-3xl border-t border-white/10 bg-[#12100d] p-5 pb-8 text-[#f5f1e8]"
          >
            <div className="mx-auto max-w-md">
              <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/20" />
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-display text-xl font-bold">Tvoja narudžba</h2>
                <button onClick={onClose} className="rounded-lg p-1.5 opacity-50 hover:opacity-100">
                  <X className="h-5 w-5" />
                </button>
              </div>

              {cart.lines.length === 0 ? (
                <p className="py-10 text-center text-sm opacity-40">Korpa je prazna.</p>
              ) : (
                <>
                  <div className="space-y-3">
                    <AnimatePresence initial={false}>
                      {cart.lines.map((line) => (
                        <motion.div
                          key={line.itemId}
                          layout
                          exit={{ opacity: 0, x: -30 }}
                          className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-3"
                        >
                          {line.imagePath && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={imageUrl(line.imagePath)!}
                              alt=""
                              className="h-12 w-12 rounded-lg object-cover"
                            />
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{line.name}</p>
                            <p className="text-xs opacity-50">
                              {fmtPrice(line.unitPrice * line.quantity, currency)}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 rounded-full border border-white/15 px-1.5 py-1">
                            <button
                              onClick={() => cart.decrement(line.itemId)}
                              className="rounded-full p-1 opacity-60 hover:opacity-100"
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </button>
                            <span className="w-5 text-center text-sm font-semibold">{line.quantity}</span>
                            <button
                              onClick={() => cart.increment(line.itemId)}
                              className="rounded-full p-1 opacity-60 hover:opacity-100"
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-4 font-bold">
                    <span>Ukupno</span>
                    <span style={{ color: primary }}>{fmtPrice(cart.total(), currency)}</span>
                  </div>

                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={onCheckout}
                    className="btn-glossy mt-4 flex w-full items-center justify-center gap-2 rounded-full py-3.5 font-semibold text-[#0c0b09]"
                    style={{ backgroundColor: primary }}
                  >
                    <Send className="h-4 w-4" />
                    Nastavi na narudžbu
                  </motion.button>
                </>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ================================================================
// Checkout
// ================================================================

function CheckoutSheet({
  open,
  onClose,
  slug,
  currency,
  primary,
  wheelItemId,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  slug: string;
  currency: string;
  primary: string;
  wheelItemId: number | null;
  onSuccess: (publicId: string) => void;
}) {
  const cart = useCart();
  const [tableNumber, setTableNumber] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const submit = async () => {
    setError(null);
    setSending(true);
    try {
      const order = await api<{ publicId: string }>(`/api/public/venues/${slug}/orders`, {
        method: 'POST',
        body: JSON.stringify({
          tableNumber: tableNumber.trim(),
          note: note.trim() || undefined,
          // osvojeni artikal na kolu (server primijeni popust samo ako je u korpi i istaknut)
          wheelItemId: wheelItemId && cart.lines.some((l) => l.itemId === wheelItemId) ? wheelItemId : undefined,
          items: cart.lines.map((l) => ({ itemId: l.itemId, quantity: l.quantity })),
        }),
      });
      onSuccess(order.publicId);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Slanje nije uspjelo, pokušajte ponovo');
      setSending(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 36 }}
            className="fixed inset-x-0 bottom-0 z-50 rounded-t-3xl border-t border-white/10 bg-[#12100d] p-5 pb-8 text-[#f5f1e8]"
          >
            <div className="mx-auto max-w-md">
              <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/20" />
              <h2 className="mb-1 font-display text-xl font-bold">Broj stola</h2>
              <p className="mb-4 text-sm opacity-50">
                Upišite broj stola za koji naručujete — piše na stolu ili pitajte osoblje.
              </p>

              <input
                autoFocus
                placeholder="npr. 7"
                inputMode="numeric"
                maxLength={10}
                value={tableNumber}
                onChange={(e) => setTableNumber(e.target.value)}
                className="w-full rounded-xl border-2 bg-white/[0.05] px-4 py-3.5 text-center font-display text-2xl font-bold text-[#f5f1e8] outline-none transition-colors"
                style={{ borderColor: tableNumber ? primary : 'rgba(245,241,232,0.15)' }}
              />

              <textarea
                placeholder="Napomena (opcionalno)"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                maxLength={500}
                className="mt-3 w-full resize-none rounded-xl border border-white/15 bg-white/[0.05] px-4 py-3 text-sm text-[#f5f1e8] outline-none placeholder:text-[#f5f1e8]/30"
              />

              {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={submit}
                disabled={!tableNumber.trim() || sending || cart.lines.length === 0}
                className="btn-glossy mt-4 flex w-full items-center justify-center gap-2 rounded-full py-3.5 font-semibold text-[#0c0b09] disabled:opacity-40"
                style={{ backgroundColor: primary }}
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {sending ? 'Šaljemo...' : `Pošalji narudžbu · ${fmtPrice(cart.total(), currency)}`}
              </motion.button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
