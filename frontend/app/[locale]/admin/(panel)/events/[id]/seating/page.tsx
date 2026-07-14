'use client';

import { use } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { EventTabs } from '@/components/admin/EventTabs';
import { SeatingManager } from '@/components/admin/SeatingManager';

interface EventInfo {
  id: number;
  slug: string;
  name: string;
  clientNames: string | null;
}

export default function SeatingAdminPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const eventId = Number(id);

  const { data: event } = useQuery({
    queryKey: ['event', eventId],
    queryFn: () => api<EventInfo>(`/api/events/${eventId}`),
  });

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <Link
          href="/admin/events"
          className="rounded-lg p-2 text-ink/40 transition-colors hover:bg-ink/5 hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="font-display text-2xl font-bold">{event?.name ?? '...'}</h1>
          <p className="text-sm text-ink/45">Raspored sjedenja</p>
        </div>
      </div>

      <EventTabs eventId={eventId} />

      {event && <SeatingManager eventId={eventId} slug={event.slug} eventName={event.name} />}
    </div>
  );
}
