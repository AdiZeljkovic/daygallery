'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'motion/react';
import {
  LayoutDashboard,
  Store,
  Images,
  Mail,
  Users,
  LogOut,
  Loader2,
  BellRing,
  UtensilsCrossed,
  Boxes,
  CalendarCheck,
  UserCog,
  ShieldCheck,
  Sun,
  Moon,
  Bell,
  BellOff,
  Volume2,
  VolumeX,
  Menu as MenuIcon,
  X,
  ChevronDown,
} from 'lucide-react';
import type { OrderDTO } from '@platform/shared';
import { Link, usePathname, useRouter } from '@/i18n/navigation';
import { api, authApi, ApiError } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { unlockAudio, playNewOrderChime } from '@/lib/notificationSound';
import {
  getNotifyPermission,
  requestNotifyPermission,
  notify,
  registerServiceWorker,
} from '@/lib/notifications';

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
}

export default function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations('admin.nav');
  const router = useRouter();
  const pathname = usePathname();
  const qc = useQueryClient();

  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [soundOn, setSoundOn] = useState(false);
  const [notifyOn, setNotifyOn] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const { data: user, error, isLoading } = useQuery({
    queryKey: ['me'],
    queryFn: authApi.me,
    retry: false,
  });

  // 401 → login
  useEffect(() => {
    if (error instanceof ApiError && error.status === 401) {
      router.replace('/admin/login');
    }
  }, [error, router]);

  // tema + zvuk + notifikacije iz localStorage; SW registracija (PWA)
  useEffect(() => {
    setTheme((localStorage.getItem('sd_admin_theme') as 'dark' | 'light') || 'dark');
    if (localStorage.getItem('sd_sound') === 'on' && unlockAudio()) setSoundOn(true);
    setNotifyOn(getNotifyPermission() === 'granted' && localStorage.getItem('sd_notify') !== 'off');
    registerServiceWorker();
  }, []);

  // zatvori user meni na klik vani
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('sd_admin_theme', next);
  };

  const toggleSound = () => {
    if (!soundOn && unlockAudio()) {
      setSoundOn(true);
      localStorage.setItem('sd_sound', 'on');
      playNewOrderChime();
    } else {
      setSoundOn(false);
      localStorage.setItem('sd_sound', 'off');
    }
  };

  const toggleNotify = async () => {
    if (!notifyOn) {
      const perm = await requestNotifyPermission();
      if (perm === 'granted') {
        setNotifyOn(true);
        localStorage.setItem('sd_notify', 'on');
        notify('Special Day Panel', 'Notifikacije su uključene ✓', 'test');
      }
    } else {
      setNotifyOn(false);
      localStorage.setItem('sd_notify', 'off');
    }
  };

  const myVenueId = user?.staff?.venueId ?? user?.venues?.[0]?.id ?? null;

  const { data: pendingImages } = useQuery({
    queryKey: ['moderationPending'],
    queryFn: () => api<unknown[]>('/api/events/moderation/pending'),
    enabled: user?.role === 'superadmin',
    refetchInterval: 60_000,
  });

  // ================================================================
  // Globalni socket: narudžbe/taskovi/zalihe → notifikacija + zvuk
  // ================================================================
  const handleOrderNew = useCallback(
    (order: OrderDTO) => {
      qc.invalidateQueries({ queryKey: ['orders'] });
      if (localStorage.getItem('sd_sound') === 'on') playNewOrderChime();
      if (localStorage.getItem('sd_notify') !== 'off') {
        notify('Nova narudžba 🔔', `Sto ${order.tableNumber} · ${order.total}`, `order-${order.id}`);
      }
    },
    [qc]
  );

  useEffect(() => {
    if (!user || !myVenueId) return;
    const socket = getSocket();

    const subscribe = () => socket.emit('venue:subscribe', myVenueId);
    if (socket.connected) subscribe();
    socket.on('connect', subscribe);

    const onTaskNew = (task: { title: string; kind: string }) => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      if (localStorage.getItem('sd_notify') !== 'off') {
        notify(task.kind === 'shift' ? 'Nova smjena 📅' : 'Novi zadatak ✅', task.title, 'task-new');
      }
    };
    const onStockLow = (info: { name: string; qty: number }) => {
      qc.invalidateQueries({ queryKey: ['menu'] });
      if (localStorage.getItem('sd_notify') !== 'off') {
        notify('Nisko stanje ⚠️', `${info.name}: ostalo ${info.qty}`, `stock-${info.name}`);
      }
    };
    const onStockOut = (info: { name: string }) => {
      qc.invalidateQueries({ queryKey: ['menu'] });
      if (localStorage.getItem('sd_notify') !== 'off') {
        notify('Nema na stanju ⛔', `${info.name} je sklonjen sa menija`, `stock-${info.name}`);
      }
    };

    socket.on('order:new', handleOrderNew);
    socket.on('task:new', onTaskNew);
    socket.on('stock:low', onStockLow);
    socket.on('stock:out', onStockOut);

    return () => {
      socket.off('connect', subscribe);
      socket.off('order:new', handleOrderNew);
      socket.off('task:new', onTaskNew);
      socket.off('stock:low', onStockLow);
      socket.off('stock:out', onStockOut);
    };
  }, [user, myVenueId, qc, handleOrderNew]);

  if (isLoading || !user) {
    return (
      <main className="admin-dark flex min-h-screen items-center justify-center bg-cream">
        <Loader2 className="h-6 w-6 animate-spin text-gold-dark" />
      </main>
    );
  }

  // ================================================================
  // Role-based navigacija
  // ================================================================
  const nav: NavItem[] = [];

  if (user.role === 'superadmin') {
    nav.push(
      { href: '/admin/dashboard', label: t('dashboard'), icon: LayoutDashboard },
      { href: '/admin/venues', label: t('venues'), icon: Store },
      { href: '/admin/events', label: 'Galerije', icon: Images },
      { href: '/admin/invites', label: t('invites'), icon: Mail },
      {
        href: '/admin/moderation',
        label: 'Moderacija',
        icon: ShieldCheck,
        badge: pendingImages?.length || undefined,
      },
      { href: '/admin/users', label: t('users'), icon: Users }
    );
  } else if (user.role === 'staff') {
    nav.push({ href: '/admin/staff-home', label: 'Moj dan', icon: LayoutDashboard });
    if (myVenueId) {
      nav.push({ href: `/admin/venues/${myVenueId}/orders`, label: 'Narudžbe', icon: BellRing });
    }
  } else {
    if (myVenueId) {
      nav.push(
        { href: `/admin/venues/${myVenueId}/orders`, label: 'Narudžbe', icon: BellRing },
        { href: `/admin/venues/${myVenueId}/menu`, label: 'Meni', icon: UtensilsCrossed },
        { href: `/admin/venues/${myVenueId}/inventory`, label: 'Inventar', icon: Boxes },
        { href: `/admin/venues/${myVenueId}/tasks`, label: 'Zadaci', icon: CalendarCheck },
        { href: `/admin/venues/${myVenueId}/staff`, label: 'Osoblje', icon: UserCog }
      );
      if ((user.venues?.length ?? 0) > 1) {
        nav.push({ href: '/admin/venues', label: t('venues'), icon: Store });
      }
    }
    if ((user.events?.length ?? 0) > 0) {
      nav.push({ href: '/admin/my-gallery', label: 'Moja galerija', icon: Images });
      nav.push({ href: '/admin/invites', label: t('invites'), icon: Mail });
    }
    if (nav.length === 0) {
      nav.push({ href: '/admin/dashboard', label: t('dashboard'), icon: LayoutDashboard });
    }
  }

  const handleLogout = async () => {
    await authApi.logout();
    router.replace('/admin/login');
  };

  const roleLabel =
    user.role === 'superadmin'
      ? 'Administrator'
      : user.role === 'staff'
        ? user.staff?.role === 'kitchen'
          ? 'Kuhinja & Šank'
          : user.staff?.role === 'waiter'
            ? 'Konobar'
            : 'Šef'
        : myVenueId
          ? 'Šef'
          : 'Klijent';

  const contextName = user.staff?.venueName ?? (user.role === 'client' ? user.venues?.[0]?.name : null);

  return (
    <div className={`${theme === 'dark' ? 'admin-dark' : ''} min-h-screen bg-cream`}>
      {/* ============ HEADER ============ */}
      <header className="sticky top-0 z-40 border-b border-ink/8 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
          {/* Logo + kontekst */}
          <Link
            href={nav[0]?.href ?? '/admin/dashboard'}
            className="flex shrink-0 items-baseline gap-2"
          >
            <span className="font-display text-xl font-bold leading-none">
              Special Day<span className="text-gold">.</span>
            </span>
            {contextName && (
              <span className="hidden max-w-36 truncate text-xs font-medium text-ink/40 lg:block">
                {contextName}
              </span>
            )}
          </Link>

          {/* Nav — centriran, pill stil (desktop) */}
          <nav className="scrollbar-none mx-auto hidden items-center gap-1 overflow-x-auto md:flex">
            {nav.map(({ href, label, icon: Icon, badge }) => {
              const active = pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`relative flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                    active ? 'text-neutral-900' : 'text-ink/55 hover:bg-ink/5 hover:text-ink'
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="topnav-active"
                      className="absolute inset-0 rounded-full bg-gold shadow-soft"
                      transition={{ type: 'spring', stiffness: 400, damping: 34 }}
                    />
                  )}
                  <Icon className="relative h-4 w-4" />
                  <span className="relative">{label}</span>
                  {badge !== undefined && badge > 0 && (
                    <span
                      className={`relative rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                        active ? 'bg-neutral-900/15 text-neutral-900' : 'bg-amber-400 text-neutral-900'
                      }`}
                    >
                      {badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Desni blok: prekidači + korisnik */}
          <div className="ml-auto flex shrink-0 items-center gap-1.5">
            <HeaderToggle
              active={notifyOn}
              onClick={toggleNotify}
              title={notifyOn ? 'Isključi notifikacije' : 'Uključi sistemske notifikacije'}
            >
              {notifyOn ? <Bell className="h-[17px] w-[17px]" /> : <BellOff className="h-[17px] w-[17px]" />}
            </HeaderToggle>
            <HeaderToggle
              active={soundOn}
              onClick={toggleSound}
              title={soundOn ? 'Isključi zvuk' : 'Uključi zvuk notifikacija'}
            >
              {soundOn ? <Volume2 className="h-[17px] w-[17px]" /> : <VolumeX className="h-[17px] w-[17px]" />}
            </HeaderToggle>
            <HeaderToggle
              active={false}
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Svijetla tema' : 'Tamna tema'}
            >
              {theme === 'dark' ? <Sun className="h-[17px] w-[17px]" /> : <Moon className="h-[17px] w-[17px]" />}
            </HeaderToggle>

            {/* Korisnik dropdown */}
            <div ref={userMenuRef} className="relative ml-1.5">
              <button
                onClick={() => setUserMenuOpen((open) => !open)}
                className="flex items-center gap-2.5 rounded-full border border-ink/10 py-1 pl-1 pr-3 transition-colors hover:border-gold/50"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gold font-display text-sm font-bold text-neutral-900">
                  {user.name[0]?.toUpperCase()}
                </span>
                <span className="hidden text-left sm:block">
                  <span className="block max-w-28 truncate text-xs font-semibold leading-tight">
                    {user.name}
                  </span>
                  <span className="block text-[10px] leading-tight text-ink/40">{roleLabel}</span>
                </span>
                <ChevronDown
                  className={`h-3.5 w-3.5 text-ink/40 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`}
                />
              </button>

              <AnimatePresence>
                {userMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.96 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-full mt-2 w-52 overflow-hidden rounded-xl border border-ink/8 bg-white shadow-lifted"
                  >
                    <div className="border-b border-ink/6 px-4 py-3">
                      <p className="truncate text-sm font-semibold">{user.name}</p>
                      <p className="truncate text-xs text-ink/45">{user.email}</p>
                      <span className="mt-1.5 inline-block rounded-full bg-gold/12 px-2 py-0.5 text-[10px] font-bold text-gold-dark">
                        {roleLabel}
                      </span>
                    </div>
                    <button
                      onClick={handleLogout}
                      className="flex w-full items-center gap-2.5 px-4 py-3 text-sm font-medium text-ink/60 transition-colors hover:bg-red-50 hover:text-red-600"
                    >
                      <LogOut className="h-4 w-4" />
                      {t('logout')}
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Mobile hamburger */}
            <button
              className="ml-1 rounded-lg p-2 text-ink/60 md:hidden"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <MenuIcon className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile nav — velike stavke */}
        <AnimatePresence>
          {mobileOpen && (
            <motion.nav
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden border-t border-ink/6 md:hidden"
            >
              <div className="space-y-1 px-4 py-3">
                {nav.map(({ href, label, icon: Icon, badge }) => {
                  const active = pathname.startsWith(href);
                  return (
                    <Link
                      key={href}
                      href={href}
                      onClick={() => setMobileOpen(false)}
                      className={`flex items-center gap-3 rounded-xl px-4 py-3.5 text-base font-semibold transition-colors ${
                        active ? 'bg-gold text-neutral-900' : 'text-ink/60 hover:bg-ink/5'
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                      <span className="flex-1">{label}</span>
                      {badge !== undefined && badge > 0 && (
                        <span className="rounded-full bg-amber-400 px-2 py-0.5 text-xs font-bold text-neutral-900">
                          {badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </motion.nav>
          )}
        </AnimatePresence>
      </header>

      {/* ============ SADRŽAJ ============ */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <motion.div
          key={pathname}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        >
          {children}
        </motion.div>
      </main>
    </div>
  );
}

function HeaderToggle({
  active,
  onClick,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors ${
        active ? 'bg-gold/15 text-gold-dark' : 'text-ink/40 hover:bg-ink/5 hover:text-ink'
      }`}
    >
      {children}
    </button>
  );
}
