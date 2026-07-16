'use client';

import { use, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'motion/react';
import {
  Plus,
  Trash2,
  KeyRound,
  Loader2,
  X,
  UserCog,
  ChefHat,
  Coffee,
  ShieldCheck,
  Crown,
  UsersRound,
  Sparkles,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api';

interface StaffMember {
  id: number;
  userId: number;
  name: string;
  email: string;
  role: 'manager' | 'waiter' | 'kitchen';
  isActive: boolean;
}

interface VenueWithOwner {
  id: number;
  name: string;
  owner: { id: number; name: string; email: string } | null;
}

const ROLE_META = {
  manager: { label: 'Šef', icon: ShieldCheck, tint: 'bg-gold/12 text-gold-dark' },
  waiter: { label: 'Konobar', icon: Coffee, tint: 'bg-emerald-50 text-emerald-600' },
  kitchen: { label: 'Šank & Kuhinja', icon: ChefHat, tint: 'bg-amber-50 text-amber-700' },
} as const;

// Redoslijed prikaza grupa
const ROLE_ORDER = ['manager', 'waiter', 'kitchen'] as const;

export default function StaffPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: venueId } = use(params);
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [teamOpen, setTeamOpen] = useState(false);
  const [passwordFor, setPasswordFor] = useState<StaffMember | null>(null);

  const { data: venue } = useQuery({
    queryKey: ['venueOwner', venueId],
    queryFn: () => api<VenueWithOwner>(`/api/venues/${venueId}`),
  });

  const { data: staff, isLoading } = useQuery({
    queryKey: ['staff', venueId],
    queryFn: () => api<StaffMember[]>(`/api/venues/${venueId}/staff`),
  });

  const deleteStaff = useMutation({
    mutationFn: (staffId: number) => api(`/api/staff/${staffId}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['staff', venueId] }),
  });

  // Grupa naloga dodijeljena objektu (superadmin je dodjeljuje; šef dodaje naloge)
  const [addToGroupOpen, setAddToGroupOpen] = useState(false);
  const { data: venueGroup } = useQuery({
    queryKey: ['venueGroup', venueId],
    queryFn: () => api<{ id: number; name: string; members: StaffMember[] } | null>(`/api/venues/${venueId}/group`),
  });

  const removeGroupMember = useMutation({
    mutationFn: (memberId: number) =>
      api(`/api/venues/${venueId}/group/members/${memberId}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['venueGroup', venueId] }),
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ['staff', venueId] });

  // Grupisano po roli, redoslijedom ROLE_ORDER
  const groups = ROLE_ORDER.map((role) => ({
    role,
    members: (staff ?? []).filter((m) => m.role === role),
  }));

  return (
    <div className="max-w-3xl">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-ink/55">
          <UsersRound className="h-4 w-4 text-gold-dark" />
          <span>Ekipa lokala — svaki nalog se prijavljuje istim panelom.</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setTeamOpen(true)}
            className="flex items-center gap-2 rounded-full border border-gold/40 bg-gold/8 px-4 py-2.5 text-sm font-semibold text-gold-dark transition-colors hover:bg-gold/15"
          >
            <Sparkles className="h-4 w-4" />
            Kreiraj standardnu ekipu
          </button>
          <button
            onClick={() => setAddOpen(true)}
            className="btn-glossy flex items-center gap-2 rounded-full bg-gold px-4 py-2.5 text-sm font-semibold text-neutral-900"
          >
            <Plus className="h-4 w-4" />
            Dodaj radnika
          </button>
        </div>
      </div>

      {/* Admin grupe — vlasnik lokala */}
      <div className="mb-6 flex items-center gap-3 rounded-2xl border border-gold/25 bg-gradient-to-br from-gold/[0.10] to-transparent p-4 shadow-soft">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gold/20 text-gold-dark">
          <Crown className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-semibold">{venue?.owner?.name ?? 'Vlasnik'}</h3>
            <span className="rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-semibold text-gold-dark">
              Admin · Šef lokala
            </span>
          </div>
          <p className="truncate text-sm text-ink/45">{venue?.owner?.email ?? ''}</p>
        </div>
        <span className="hidden text-[11px] text-ink/35 sm:block">Puna kontrola</span>
      </div>

      {/* Grupa naloga dodijeljena objektu */}
      {venueGroup && (
        <div className="mb-6 rounded-2xl border border-ink/8 bg-white p-4 shadow-soft">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <UsersRound className="h-4 w-4 text-gold-dark" />
              <h2 className="font-display text-base font-bold">Grupa: {venueGroup.name}</h2>
              <span className="rounded-full bg-ink/5 px-1.5 text-[10px] font-semibold text-ink/40">
                {venueGroup.members.length}
              </span>
            </div>
            <button
              onClick={() => setAddToGroupOpen(true)}
              className="flex items-center gap-1.5 rounded-full bg-gold/12 px-3.5 py-2 text-xs font-semibold text-gold-dark transition-colors hover:bg-gold/25"
            >
              <Plus className="h-3.5 w-3.5" /> Dodaj u grupu
            </button>
          </div>
          <div className="space-y-2">
            {venueGroup.members.map((m) => {
              const meta = ROLE_META[m.role];
              return (
                <div key={m.id} className="flex items-center gap-3 rounded-xl border border-ink/8 bg-ink/[0.015] p-3">
                  <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${meta.tint}`}>
                    <meta.icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold">{m.name}</p>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${meta.tint}`}>
                        {meta.label}
                      </span>
                    </div>
                    <p className="truncate text-xs text-ink/45">{m.email}</p>
                  </div>
                  <button
                    onClick={() => {
                      if (confirm(`Ukloniti "${m.name}" iz grupe? Nalog bez drugih veza se briše.`))
                        removeGroupMember.mutate(m.id);
                    }}
                    className="rounded-lg p-2 text-ink/35 transition-colors hover:bg-red-50 hover:text-red-500"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
            {venueGroup.members.length === 0 && (
              <p className="py-3 text-center text-sm text-ink/40">
                Grupa još nema naloga — dodaj konobara i šank/kuhinju.
              </p>
            )}
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-gold-dark" />
        </div>
      ) : !staff?.length ? (
        <div className="rounded-2xl border border-dashed border-ink/15 py-16 text-center">
          <UserCog className="mx-auto mb-3 h-8 w-8 text-ink/20" />
          <p className="text-ink/40">Ekipa još nema članova.</p>
          <p className="mt-1 text-sm text-ink/30">
            Klikni „Kreiraj standardnu ekipu" — odmah dobijaš konobara i šank/kuhinju.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map((g) => {
            if (g.members.length === 0) return null;
            const GroupIcon = ROLE_META[g.role].icon;
            return (
                <section key={g.role}>
                  <div className="mb-2 flex items-center gap-2">
                    <GroupIcon className="h-4 w-4 text-ink/40" />
                    <h2 className="text-xs font-bold uppercase tracking-wider text-ink/45">
                      {ROLE_META[g.role].label}
                    </h2>
                    <span className="rounded-full bg-ink/5 px-1.5 text-[10px] font-semibold text-ink/40">
                      {g.members.length}
                    </span>
                  </div>
                  <div className="space-y-2.5">
                    {g.members.map((member) => {
                      const meta = ROLE_META[member.role];
                      return (
                        <motion.div
                          key={member.id}
                          layout
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="flex flex-wrap items-center gap-3 rounded-2xl border border-ink/8 bg-white p-4 shadow-soft"
                        >
                          <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${meta.tint}`}>
                            <meta.icon className="h-5 w-5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <h3 className="truncate font-semibold">{member.name}</h3>
                            <p className="truncate text-sm text-ink/45">{member.email}</p>
                          </div>
                          <button
                            onClick={() => setPasswordFor(member)}
                            className="flex items-center gap-1.5 rounded-lg bg-ink/5 px-3 py-2 text-xs font-medium text-ink/60 transition-colors hover:bg-gold/10 hover:text-gold-dark"
                          >
                            <KeyRound className="h-3.5 w-3.5" /> Lozinka
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`Obrisati radnika "${member.name}"? Nalog se briše trajno.`))
                                deleteStaff.mutate(member.id);
                            }}
                            className="rounded-lg p-2 text-ink/40 transition-colors hover:bg-red-50 hover:text-red-500"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </motion.div>
                      );
                    })}
                  </div>
                </section>
            );
          })}
        </div>
      )}

      {addOpen && (
        <AddStaffModal
          venueId={venueId}
          onClose={() => setAddOpen(false)}
          onSaved={() => {
            setAddOpen(false);
            refresh();
          }}
        />
      )}
      {addToGroupOpen && venueGroup && (
        <AddStaffModal
          venueId={venueId}
          endpoint={`/api/venues/${venueId}/group/members`}
          title={`Novi nalog — grupa ${venueGroup.name}`}
          onClose={() => setAddToGroupOpen(false)}
          onSaved={() => {
            setAddToGroupOpen(false);
            qc.invalidateQueries({ queryKey: ['venueGroup', venueId] });
          }}
        />
      )}
      {teamOpen && (
        <StandardTeamModal
          venueId={venueId}
          onClose={() => setTeamOpen(false)}
          onSaved={() => {
            setTeamOpen(false);
            refresh();
          }}
        />
      )}
      {passwordFor && (
        <PasswordModal
          member={passwordFor}
          onClose={() => setPasswordFor(null)}
          onSaved={() => setPasswordFor(null)}
        />
      )}
    </div>
  );
}

const inputCls =
  'w-full rounded-lg border border-ink/12 px-3 py-2 text-sm outline-none transition-colors focus:border-gold';

function AddStaffModal({
  venueId,
  endpoint,
  title = 'Novi radnik',
  onClose,
  onSaved,
}: {
  venueId: string;
  endpoint?: string;
  title?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'waiter' | 'kitchen' | 'manager'>('waiter');
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () =>
      api(endpoint ?? `/api/venues/${venueId}/staff`, {
        method: 'POST',
        body: JSON.stringify({ name, email, password, role }),
      }),
    onSuccess: onSaved,
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Greška'),
  });

  return (
    <ModalShell title={title} onClose={onClose}>
      <div className="space-y-3">
        <input autoFocus placeholder="Ime i prezime" value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
        <input type="email" placeholder="Email (za prijavu)" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
        <input type="text" placeholder="Lozinka (min. 8 znakova)" value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} />

        <div>
          <span className="mb-1.5 block text-xs font-medium text-ink/50">Uloga</span>
          <div className="grid grid-cols-3 gap-2">
            {(['waiter', 'kitchen', 'manager'] as const).map((r) => {
                const meta = ROLE_META[r];
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    className={`flex flex-col items-center gap-1 rounded-lg border py-2.5 text-xs font-medium transition-colors ${
                      role === r
                        ? 'border-gold bg-gold/10 text-gold-dark'
                        : 'border-ink/10 text-ink/50 hover:border-ink/25'
                    }`}
                  >
                    <meta.icon className="h-4 w-4" />
                    {meta.label}
                  </button>
                );
              })}
          </div>
          <p className="mt-2 text-xs text-ink/40">
            {role === 'manager'
              ? 'Šef: puna kontrola — meni, inventar, zadaci, osoblje.'
              : 'Vidi narudžbe, svoje zadatke i smjene. Ne može mijenjati meni.'}
          </p>
        </div>
      </div>

      {error && <p className="mt-3 text-sm text-red-500">{error}</p>}

      <button
        onClick={() => save.mutate()}
        disabled={!name.trim() || !email.trim() || password.length < 8 || save.isPending}
        className="btn-glossy mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-gold py-2.5 text-sm font-semibold text-neutral-900 disabled:opacity-50"
      >
        {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
        Kreiraj nalog
      </button>
    </ModalShell>
  );
}

type TeamRole = 'waiter' | 'kitchen';

function StandardTeamModal({
  venueId,
  onClose,
  onSaved,
}: {
  venueId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [rows, setRows] = useState<Record<TeamRole, { on: boolean; name: string; email: string; password: string }>>({
    waiter: { on: true, name: '', email: '', password: '' },
    kitchen: { on: true, name: '', email: '', password: '' },
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (role: TeamRole, patch: Partial<{ on: boolean; name: string; email: string; password: string }>) =>
    setRows((prev) => ({ ...prev, [role]: { ...prev[role], ...patch } }));

  const active = (['waiter', 'kitchen'] as TeamRole[]).filter((r) => rows[r].on);
  const valid =
    active.length > 0 &&
    active.every((r) => rows[r].name.trim() && rows[r].email.trim() && rows[r].password.length >= 8);

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      for (const role of active) {
        const { name, email, password } = rows[role];
        await api(`/api/venues/${venueId}/staff`, {
          method: 'POST',
          body: JSON.stringify({ name, email, password, role }),
        });
      }
      onSaved();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Greška pri kreiranju ekipe');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalShell title="Standardna ekipa lokala" onClose={onClose}>
      <p className="mb-4 text-sm text-ink/50">
        Kreiraj naloge za ekipu odjednom. Admin (Šef lokala) već postoji — ovo dodaje konobara i
        šank/kuhinju.
      </p>
      <div className="space-y-3">
        {(['waiter', 'kitchen'] as TeamRole[]).map((role) => {
          const meta = ROLE_META[role];
          const row = rows[role];
          return (
            <div
              key={role}
              className={`rounded-xl border p-3 transition-colors ${row.on ? 'border-gold/40 bg-gold/[0.04]' : 'border-ink/10 opacity-60'}`}
            >
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={row.on}
                  onChange={(e) => set(role, { on: e.target.checked })}
                  className="h-4 w-4 accent-[#d4af37]"
                />
                <meta.icon className="h-4 w-4 text-ink/50" />
                <span className="text-sm font-semibold">{meta.label}</span>
              </label>
              {row.on && (
                <div className="mt-2.5 space-y-2">
                  <input placeholder="Ime i prezime" value={row.name} onChange={(e) => set(role, { name: e.target.value })} className={inputCls} />
                  <div className="grid grid-cols-2 gap-2">
                    <input type="email" placeholder="Email" value={row.email} onChange={(e) => set(role, { email: e.target.value })} className={inputCls} />
                    <input type="text" placeholder="Lozinka (min. 8)" value={row.password} onChange={(e) => set(role, { password: e.target.value })} className={inputCls} />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {error && <p className="mt-3 text-sm text-red-500">{error}</p>}

      <button
        onClick={create}
        disabled={!valid || busy}
        className="btn-glossy mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-gold py-2.5 text-sm font-semibold text-neutral-900 disabled:opacity-50"
      >
        {busy && <Loader2 className="h-4 w-4 animate-spin" />}
        Kreiraj ekipu ({active.length})
      </button>
    </ModalShell>
  );
}

function PasswordModal({
  member,
  onClose,
  onSaved,
}: {
  member: StaffMember;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () =>
      api(`/api/staff/${member.id}/password`, {
        method: 'PATCH',
        body: JSON.stringify({ password }),
      }),
    onSuccess: onSaved,
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Greška'),
  });

  return (
    <ModalShell title={`Nova lozinka — ${member.name}`} onClose={onClose}>
      <input
        autoFocus
        type="text"
        placeholder="Nova lozinka (min. 8 znakova)"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className={inputCls}
      />
      <p className="mt-2 text-xs text-ink/40">Radnik će biti odjavljen sa svih uređaja.</p>
      {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
      <button
        onClick={() => save.mutate()}
        disabled={password.length < 8 || save.isPending}
        className="btn-glossy mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-gold py-2.5 text-sm font-semibold text-neutral-900 disabled:opacity-50"
      >
        {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
        Sačuvaj
      </button>
    </ModalShell>
  );
}

function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
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
          <h3 className="font-display text-lg font-bold">{title}</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-ink/40 hover:bg-ink/5 hover:text-ink">
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </motion.div>
    </motion.div>
  );
}
