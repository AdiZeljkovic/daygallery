'use client';

import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { motion } from 'motion/react';
import { Store, ArrowRight } from 'lucide-react';
import { Link, useRouter } from '@/i18n/navigation';
import { api, authApi } from '@/lib/api';

interface VenueRow {
  id: number;
  slug: string;
  name: string;
  address: string | null;
  isActive: boolean;
  owner?: { name: string; email: string };
}

export default function DashboardPage() {
  const t = useTranslations('admin.dashboard');
  const router = useRouter();
  const { data: user } = useQuery({ queryKey: ['me'], queryFn: authApi.me, retry: false });
  const { data: venues } = useQuery({
    queryKey: ['venues'],
    queryFn: () => api<VenueRow[]>('/api/venues'),
    enabled: !!user && user.role === 'superadmin',
  });

  // Role-based početna: klijenti i osoblje idu na svoju stranicu
  useEffect(() => {
    if (!user || user.role === 'superadmin') return;
    if (user.role === 'staff') {
      router.replace('/admin/staff-home');
    } else if (user.venues?.length) {
      router.replace(`/admin/venues/${user.venues[0].id}/orders`);
    } else if (user.events?.length) {
      router.replace('/admin/my-gallery');
    }
  }, [user, router]);

  if (!user || user.role !== 'superadmin') return null;

  return (
    <div>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h1 className="font-display text-3xl font-bold">{t('welcome', { name: user.name })}</h1>
        <p className="mt-1 text-sm text-ink/50">
          {t('role')}: {user.role === 'superadmin' ? t('superadmin') : t('client')}
        </p>
      </motion.div>

      <section className="mt-8">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-ink/45">
          {t('venues')}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {venues?.map((venue, i) => (
            <motion.div
              key={venue.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: i * 0.06 }}
              whileHover={{ y: -3 }}
            >
              <Link
                href={`/admin/venues/${venue.id}/menu`}
                className="group block rounded-xl border border-ink/8 bg-white p-5 shadow-soft transition-shadow hover:shadow-lifted"
              >
                <div className="flex items-start justify-between">
                  <div className="rounded-lg bg-gold/12 p-2.5">
                    <Store className="h-5 w-5 text-gold-dark" />
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      venue.isActive ? 'bg-emerald-50 text-emerald-600' : 'bg-ink/5 text-ink/40'
                    }`}
                  >
                    {venue.isActive ? 'Aktivan' : 'Neaktivan'}
                  </span>
                </div>
                <h3 className="mt-3 font-semibold">{venue.name}</h3>
                {venue.address && <p className="mt-0.5 text-sm text-ink/50">{venue.address}</p>}
                {user.role === 'superadmin' && venue.owner && (
                  <p className="mt-2 text-xs text-ink/40">Vlasnik: {venue.owner.name}</p>
                )}
                <span className="mt-3 flex items-center gap-1 text-xs font-medium text-gold-dark opacity-0 transition-opacity group-hover:opacity-100">
                  Upravljaj <ArrowRight className="h-3 w-3" />
                </span>
              </Link>
            </motion.div>
          ))}
        </div>
      </section>
    </div>
  );
}
