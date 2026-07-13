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

const ROLE_META = {
  manager: { label: 'Šef', icon: ShieldCheck, tint: 'bg-gold/12 text-gold-dark' },
  waiter: { label: 'Konobar', icon: Coffee, tint: 'bg-emerald-50 text-emerald-600' },
  kitchen: { label: 'Kuhinja & Šank', icon: ChefHat, tint: 'bg-amber-50 text-amber-700' },
} as const;

export default function StaffPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: venueId } = use(params);
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [passwordFor, setPasswordFor] = useState<StaffMember | null>(null);

  const { data: staff, isLoading } = useQuery({
    queryKey: ['staff', venueId],
    queryFn: () => api<StaffMember[]>(`/api/venues/${venueId}/staff`),
  });

  const deleteStaff = useMutation({
    mutationFn: (staffId: number) => api(`/api/staff/${staffId}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['staff', venueId] }),
  });

  return (
    <div className="max-w-3xl">
      <div className="mb-5 flex items-center justify-between">
        <p className="text-sm text-ink/50">
          Radnici se prijavljuju istim panelom — vide narudžbe, svoje zadatke i smjene.
        </p>
        <button
          onClick={() => setAddOpen(true)}
          className="btn-glossy flex items-center gap-2 rounded-full bg-gold px-4 py-2.5 text-sm font-semibold text-neutral-900"
        >
          <Plus className="h-4 w-4" />
          Dodaj radnika
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-gold-dark" />
        </div>
      ) : !staff?.length ? (
        <div className="rounded-xl border border-dashed border-ink/15 py-16 text-center">
          <UserCog className="mx-auto mb-3 h-8 w-8 text-ink/20" />
          <p className="text-ink/40">Nema radnika još.</p>
          <p className="mt-1 text-sm text-ink/30">
            Dodaj konobare i kuhinju — svako dobija svoj nalog za prijavu.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {staff.map((member, i) => {
            const meta = ROLE_META[member.role];
            return (
              <motion.div
                key={member.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-ink/8 bg-white p-4 shadow-soft"
              >
                <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${meta.tint}`}>
                  <meta.icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate font-semibold">{member.name}</h3>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${meta.tint}`}>
                      {meta.label}
                    </span>
                  </div>
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
      )}

      {addOpen && (
        <AddStaffModal
          venueId={venueId}
          onClose={() => setAddOpen(false)}
          onSaved={() => {
            setAddOpen(false);
            qc.invalidateQueries({ queryKey: ['staff', venueId] });
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
  onClose,
  onSaved,
}: {
  venueId: string;
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
      api(`/api/venues/${venueId}/staff`, {
        method: 'POST',
        body: JSON.stringify({ name, email, password, role }),
      }),
    onSuccess: onSaved,
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Greška'),
  });

  return (
    <ModalShell title="Novi radnik" onClose={onClose}>
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
