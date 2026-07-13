'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'motion/react';
import {
  CalendarHeart,
  Plus,
  Trash2,
  Images,
  Loader2,
  X,
  Globe,
  ShieldCheck,
} from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { api, ApiError, authApi } from '@/lib/api';
import { imageUrl } from '@/lib/menuTypes';

interface EventRow {
  id: number;
  slug: string;
  name: string;
  eventDate: string | null;
  clientNames: string | null;
  isPublicGallery: boolean;
  autoApprove: boolean;
  owner?: { id: number; name: string };
  coverImage?: { thumbPath: string } | null;
  _count: { images: number };
}

export default function EventsPage() {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);

  const { data: user } = useQuery({ queryKey: ['me'], queryFn: authApi.me, retry: false });
  const { data: events, isLoading } = useQuery({
    queryKey: ['events'],
    queryFn: () => api<EventRow[]>('/api/events'),
  });

  const deleteEvent = useMutation({
    mutationFn: (id: number) => api(`/api/events/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['events'] }),
  });

  const isSuperadmin = user?.role === 'superadmin';

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold">Galerije</h1>
          <p className="mt-1 text-sm text-ink/50">Event galerije za svadbe, rođendane i evente</p>
        </div>
        {isSuperadmin && (
          <button
            onClick={() => setCreateOpen(true)}
            className="btn-glossy flex items-center gap-2 rounded-full bg-gold px-4 py-2.5 text-sm font-semibold text-neutral-900 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Nova galerija
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-gold-dark" />
        </div>
      ) : !events?.length ? (
        <div className="rounded-xl border border-dashed border-ink/15 py-20 text-center">
          <CalendarHeart className="mx-auto mb-3 h-8 w-8 text-ink/20" />
          <p className="text-ink/40">Nema galerija još.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((event, i) => (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: i * 0.05 }}
              whileHover={{ y: -3 }}
              className="group relative overflow-hidden rounded-xl border border-ink/8 bg-white shadow-soft transition-shadow hover:shadow-lifted"
            >
              <Link href={`/admin/events/${event.id}`} className="block">
                <div className="relative h-32 bg-ink/5">
                  {event.coverImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={imageUrl(event.coverImage.thumbPath)!}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <CalendarHeart className="h-8 w-8 text-ink/15" />
                    </div>
                  )}
                  <div className="absolute right-2 top-2 flex gap-1.5">
                    {event.isPublicGallery && (
                      <span className="flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-gold-dark backdrop-blur">
                        <Globe className="h-2.5 w-2.5" /> Javna
                      </span>
                    )}
                    {!event.autoApprove && (
                      <span className="flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-ink/60 backdrop-blur">
                        <ShieldCheck className="h-2.5 w-2.5" /> Moderacija
                      </span>
                    )}
                  </div>
                </div>
                <div className="p-4">
                  <h3 className="font-semibold">{event.name}</h3>
                  {event.clientNames && (
                    <p className="mt-0.5 text-sm text-ink/50">{event.clientNames}</p>
                  )}
                  <div className="mt-2 flex items-center justify-between text-xs text-ink/40">
                    <span className="flex items-center gap-1">
                      <Images className="h-3 w-3" /> {event._count.images} slika
                    </span>
                    {event.eventDate && (
                      <span>{new Date(event.eventDate).toLocaleDateString('bs-BA')}</span>
                    )}
                  </div>
                  {isSuperadmin && event.owner && (
                    <p className="mt-1.5 text-[11px] text-ink/35">Vlasnik: {event.owner.name}</p>
                  )}
                </div>
              </Link>
              {isSuperadmin && (
                <button
                  onClick={() => {
                    if (confirm(`Obrisati galeriju "${event.name}" i sve slike?`))
                      deleteEvent.mutate(event.id);
                  }}
                  className="absolute bottom-3 right-3 rounded-lg p-2 text-ink/30 opacity-0 transition-all hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </motion.div>
          ))}
        </div>
      )}

      {createOpen && (
        <CreateEventModal
          onClose={() => setCreateOpen(false)}
          onSaved={() => {
            setCreateOpen(false);
            qc.invalidateQueries({ queryKey: ['events'] });
          }}
        />
      )}
    </div>
  );
}

function CreateEventModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState('');
  const [clientNames, setClientNames] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [autoApprove, setAutoApprove] = useState(true);
  const [ownerUserId, setOwnerUserId] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: () => api<{ id: number; name: string; email: string; role: string }[]>('/api/users'),
  });

  const save = useMutation({
    mutationFn: () =>
      api('/api/events', {
        method: 'POST',
        body: JSON.stringify({
          name,
          clientNames,
          eventDate: eventDate || undefined,
          autoApprove,
          ownerUserId: ownerUserId ? Number(ownerUserId) : undefined,
        }),
      }),
    onSuccess: onSaved,
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Greška'),
  });

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-lifted"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-lg font-bold">Nova galerija</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-ink/40 hover:bg-ink/5 hover:text-ink">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3">
          <input
            autoFocus
            placeholder="Naziv eventa (npr. Svadba Amina & Emir)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-ink/12 px-3 py-2 text-sm outline-none focus:border-gold"
          />
          <input
            placeholder="Imena klijenata (npr. Amina & Emir)"
            value={clientNames}
            onChange={(e) => setClientNames(e.target.value)}
            className="w-full rounded-lg border border-ink/12 px-3 py-2 text-sm outline-none focus:border-gold"
          />
          <input
            type="date"
            value={eventDate}
            onChange={(e) => setEventDate(e.target.value)}
            className="w-full rounded-lg border border-ink/12 px-3 py-2 text-sm outline-none focus:border-gold"
          />
          <select
            value={ownerUserId}
            onChange={(e) => setOwnerUserId(e.target.value)}
            className="w-full rounded-lg border border-ink/12 bg-white px-3 py-2 text-sm outline-none focus:border-gold"
          >
            <option value="">Vlasnik: ja (superadmin)</option>
            {users
              ?.filter((u) => u.role === 'client')
              .map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.email})
                </option>
              ))}
          </select>

          <label className="flex cursor-pointer items-center gap-2.5">
            <input
              type="checkbox"
              checked={!autoApprove}
              onChange={(e) => setAutoApprove(!e.target.checked)}
              className="h-4 w-4 accent-[#d4af37]"
            />
            <span className="text-sm">
              Ručna moderacija{' '}
              <span className="text-xs text-ink/40">(slike vidljive tek nakon odobrenja)</span>
            </span>
          </label>
        </div>

        {error && <p className="mt-3 text-sm text-red-500">{error}</p>}

        <button
          onClick={() => save.mutate()}
          disabled={!name.trim() || save.isPending}
          className="btn-glossy mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-gold py-2.5 text-sm font-semibold text-neutral-900 transition-colors disabled:opacity-50"
        >
          {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Kreiraj galeriju
        </button>
      </motion.div>
    </motion.div>
  );
}
