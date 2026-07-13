'use client';

import { use, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'motion/react';
import {
  QrCode,
  UtensilsCrossed,
  BellRing,
  ArrowLeft,
  Boxes,
  CalendarCheck,
  UserCog,
} from 'lucide-react';
import { Link, usePathname } from '@/i18n/navigation';
import { api, authApi } from '@/lib/api';
import { QrModal } from '@/components/admin/QrModal';

interface VenueDetail {
  id: number;
  slug: string;
  name: string;
  address: string | null;
  currency: string;
}

export default function VenueLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const pathname = usePathname();
  const [qrOpen, setQrOpen] = useState(false);

  const { data: venue } = useQuery({
    queryKey: ['venue', id],
    queryFn: () => api<VenueDetail>(`/api/venues/${id}`),
  });
  const { data: user } = useQuery({ queryKey: ['me'], queryFn: authApi.me, retry: false });

  const menuUrl =
    typeof window !== 'undefined' && venue ? `${window.location.origin}/m/${venue.slug}` : '';

  const isWorker = user?.staff?.role === 'waiter' || user?.staff?.role === 'kitchen';

  const tabs = [
    { href: `/admin/venues/${id}/orders`, label: 'Narudžbe', icon: BellRing },
    { href: `/admin/venues/${id}/menu`, label: 'Meni', icon: UtensilsCrossed },
    { href: `/admin/venues/${id}/inventory`, label: 'Inventar', icon: Boxes },
    { href: `/admin/venues/${id}/tasks`, label: 'Zadaci i smjene', icon: CalendarCheck },
    // Osoblje vide samo šef/manager
    ...(isWorker ? [] : [{ href: `/admin/venues/${id}/staff`, label: 'Osoblje', icon: UserCog }]),
  ];

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/dashboard"
            className="rounded-lg p-2 text-ink/40 transition-colors hover:bg-ink/5 hover:text-ink"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="font-display text-2xl font-bold">{venue?.name ?? '...'}</h1>
            {venue?.address && <p className="text-sm text-ink/45">{venue.address}</p>}
          </div>
        </div>

        <button
          onClick={() => setQrOpen(true)}
          disabled={!venue}
          className="flex items-center gap-2 rounded-lg bg-ink px-4 py-2.5 text-sm font-medium text-cream transition-colors hover:bg-ink-soft disabled:opacity-50"
        >
          <QrCode className="h-4 w-4" />
          QR meni
        </button>
      </div>

      <div className="mb-6 flex gap-1 border-b border-ink/8">
        {tabs.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`relative flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                active ? 'text-ink' : 'text-ink/45 hover:text-ink'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
              {active && (
                <motion.span
                  layoutId="venue-tab"
                  className="absolute inset-x-0 -bottom-px h-0.5 bg-gold"
                />
              )}
            </Link>
          );
        })}
      </div>

      {children}

      {venue && (
        <QrModal open={qrOpen} onClose={() => setQrOpen(false)} title={venue.name} url={menuUrl} />
      )}
    </div>
  );
}
