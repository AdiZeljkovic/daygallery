'use client';

import { motion } from 'motion/react';
import { Images, Armchair } from 'lucide-react';
import { Link, usePathname } from '@/i18n/navigation';

export function EventTabs({ eventId }: { eventId: number }) {
  const pathname = usePathname();
  const tabs = [
    { href: `/admin/events/${eventId}`, label: 'Galerija', icon: Images, exact: true },
    { href: `/admin/events/${eventId}/seating`, label: 'Sjedenje', icon: Armchair, exact: false },
  ];

  return (
    <div className="mb-6 flex gap-1 border-b border-ink/8">
      {tabs.map(({ href, label, icon: Icon, exact }) => {
        const active = exact ? pathname === href || pathname === `${href}/` : pathname.startsWith(href);
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
              <motion.span layoutId="event-tab" className="absolute inset-x-0 -bottom-px h-0.5 bg-gold" />
            )}
          </Link>
        );
      })}
    </div>
  );
}
