'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'motion/react';
import {
  Mail,
  Plus,
  Pencil,
  Trash2,
  QrCode,
  Users,
  X,
  Loader2,
  Search,
  Check,
  UserX,
  ExternalLink,
} from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { QrModal } from '@/components/admin/QrModal';

interface InviteRow {
  id: number;
  slug: string;
  title: string;
  hostNames: string;
  variant: 'standard' | 'wedding';
  date: string | null;
  event: { id: number; name: string } | null;
  _count: { rsvps: number };
}

interface RsvpData {
  rsvps: {
    id: number;
    name: string;
    phone: string | null;
    attending: boolean;
    plusOnes: number;
    note: string | null;
    createdAt: string;
  }[];
  stats: { attendingCount: number; totalGuests: number; notAttending: number };
}

export default function InvitesPage() {
  const qc = useQueryClient();
  const [qrInvite, setQrInvite] = useState<InviteRow | null>(null);
  const [rsvpInvite, setRsvpInvite] = useState<InviteRow | null>(null);

  const { data: invites, isLoading } = useQuery({
    queryKey: ['invites'],
    queryFn: () => api<InviteRow[]>('/api/invites'),
  });

  const deleteInvite = useMutation({
    mutationFn: (id: number) => api(`/api/invites/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invites'] }),
  });

  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold">Pozivnice</h1>
          <p className="mt-1 text-sm text-ink/50">Digitalne pozivnice sa RSVP sistemom</p>
        </div>
        <Link
          href="/admin/invites/new"
          className="btn-glossy flex items-center gap-2 rounded-full bg-gold px-4 py-2.5 text-sm font-semibold text-neutral-900 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Nova pozivnica
        </Link>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-gold-dark" />
        </div>
      ) : !invites?.length ? (
        <div className="rounded-xl border border-dashed border-ink/15 py-20 text-center">
          <Mail className="mx-auto mb-3 h-8 w-8 text-ink/20" />
          <p className="text-ink/40">Nema pozivnica još.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {invites.map((invite, i) => (
            <motion.div
              key={invite.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="flex flex-wrap items-center gap-3 rounded-xl border border-ink/8 bg-white p-4 shadow-soft"
            >
              <div
                className={`flex h-11 w-11 items-center justify-center rounded-xl ${
                  invite.variant === 'wedding' ? 'bg-gold/15' : 'bg-ink/5'
                }`}
              >
                <Mail
                  className={`h-5 w-5 ${invite.variant === 'wedding' ? 'text-gold-dark' : 'text-ink/40'}`}
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="truncate font-semibold">{invite.title}</h3>
                  {invite.variant === 'wedding' && (
                    <span className="rounded-full bg-gold/12 px-2 py-0.5 text-[10px] font-bold text-gold-dark">
                      Vjenčanje
                    </span>
                  )}
                </div>
                <p className="truncate text-sm text-ink/45">
                  {invite.hostNames}
                  {invite.date && ` · ${new Date(invite.date).toLocaleDateString('bs-BA')}`}
                  {invite.event && ` · ${invite.event.name}`}
                </p>
              </div>

              <button
                onClick={() => setRsvpInvite(invite)}
                className="flex items-center gap-1.5 rounded-lg bg-ink/5 px-3 py-2 text-xs font-medium text-ink/60 transition-colors hover:bg-gold/10 hover:text-gold-dark"
              >
                <Users className="h-3.5 w-3.5" />
                RSVP ({invite._count.rsvps})
              </button>
              <a
                href={`${origin}/i/${invite.slug}`}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg p-2 text-ink/40 transition-colors hover:bg-ink/5 hover:text-ink"
                title="Otvori pozivnicu"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
              <button
                onClick={() => setQrInvite(invite)}
                className="rounded-lg p-2 text-ink/40 transition-colors hover:bg-ink/5 hover:text-ink"
                title="QR kod"
              >
                <QrCode className="h-4 w-4" />
              </button>
              <Link
                href={`/admin/invites/${invite.id}/edit`}
                className="rounded-lg p-2 text-ink/40 transition-colors hover:bg-ink/5 hover:text-ink"
                title="Uredi"
              >
                <Pencil className="h-4 w-4" />
              </Link>
              <button
                onClick={() => {
                  if (confirm(`Obrisati pozivnicu "${invite.title}"?`)) deleteInvite.mutate(invite.id);
                }}
                className="rounded-lg p-2 text-ink/40 transition-colors hover:bg-red-50 hover:text-red-500"
                title="Obriši"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </motion.div>
          ))}
        </div>
      )}

      {qrInvite && (
        <QrModal
          open
          onClose={() => setQrInvite(null)}
          title={qrInvite.title}
          url={`${origin}/i/${qrInvite.slug}`}
        />
      )}
      {rsvpInvite && <RsvpModal invite={rsvpInvite} onClose={() => setRsvpInvite(null)} />}
    </div>
  );
}

function RsvpModal({ invite, onClose }: { invite: InviteRow; onClose: () => void }) {
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['rsvps', invite.id],
    queryFn: () => api<RsvpData>(`/api/invites/${invite.id}/rsvps`),
    refetchInterval: 5_000, // live tokom slanja pozivnica
  });

  const q = search.toLowerCase();
  const filtered = data?.rsvps.filter((r) => r.name.toLowerCase().includes(q)) ?? [];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
        className="flex max-h-[80vh] w-full max-w-lg flex-col rounded-2xl bg-white shadow-lifted"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-ink/8 p-5">
          <div>
            <h3 className="font-display text-lg font-bold">RSVP — {invite.title}</h3>
            <p className="text-xs text-ink/45">Osvježava se automatski</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-ink/40 hover:bg-ink/5 hover:text-ink">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Statistika */}
        <div className="grid grid-cols-3 gap-3 p-5 pb-3">
          <StatBox label="Dolazi (osoba)" value={data?.stats.totalGuests ?? '—'} accent="text-emerald-600" />
          <StatBox label="Potvrda" value={data?.stats.attendingCount ?? '—'} accent="text-gold-dark" />
          <StatBox label="Ne dolazi" value={data?.stats.notAttending ?? '—'} accent="text-ink/50" />
        </div>

        <div className="px-5 pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/30" />
            <input
              placeholder="Pretraži goste..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-ink/12 py-2 pl-9 pr-3 text-sm outline-none focus:border-gold"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-5">
          {isLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-gold-dark" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="py-10 text-center text-sm text-ink/35">Nema odgovora još.</p>
          ) : (
            <div className="space-y-2">
              <AnimatePresence initial={false}>
                {filtered.map((rsvp) => (
                  <motion.div
                    key={rsvp.id}
                    layout
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-start gap-3 rounded-lg border border-ink/6 p-3"
                  >
                    <span
                      className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                        rsvp.attending ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'
                      }`}
                    >
                      {rsvp.attending ? <Check className="h-3.5 w-3.5" /> : <UserX className="h-3.5 w-3.5" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">
                        {rsvp.name}
                        {rsvp.attending && rsvp.plusOnes > 0 && (
                          <span className="ml-1.5 rounded-full bg-gold/12 px-1.5 py-0.5 text-[10px] font-bold text-gold-dark">
                            +{rsvp.plusOnes}
                          </span>
                        )}
                      </p>
                      {rsvp.phone && <p className="text-xs text-ink/40">{rsvp.phone}</p>}
                      {rsvp.note && <p className="mt-1 text-xs italic text-ink/50">"{rsvp.note}"</p>}
                    </div>
                    <span className="shrink-0 text-[10px] text-ink/30">
                      {new Date(rsvp.createdAt).toLocaleDateString('bs-BA')}
                    </span>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

function StatBox({ label, value, accent }: { label: string; value: number | string; accent: string }) {
  return (
    <div className="rounded-xl bg-ink/[0.03] p-3 text-center">
      <p className={`font-display text-2xl font-bold ${accent}`}>{value}</p>
      <p className="mt-0.5 text-[11px] text-ink/45">{label}</p>
    </div>
  );
}
