'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'motion/react';
import {
  Users,
  Plus,
  Trash2,
  KeyRound,
  Loader2,
  X,
  ShieldCheck,
  Store,
  Power,
} from 'lucide-react';
import { api, ApiError, authApi } from '@/lib/api';

interface UserRow {
  id: number;
  email: string;
  name: string;
  role: 'superadmin' | 'client';
  isActive: boolean;
  createdAt: string;
  venues: { id: number; name: string }[];
}

export default function UsersPage() {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [passwordUser, setPasswordUser] = useState<UserRow | null>(null);

  const { data: me } = useQuery({ queryKey: ['me'], queryFn: authApi.me, retry: false });
  const { data: users, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => api<UserRow[]>('/api/users'),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['users'] });

  const deleteUser = useMutation({
    mutationFn: (id: number) => api(`/api/users/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  });

  const toggleActive = useMutation({
    mutationFn: (user: UserRow) =>
      api(`/api/users/${user.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !user.isActive }),
      }),
    onSuccess: invalidate,
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold">Korisnici</h1>
          <p className="mt-1 text-sm text-ink/50">
            Klijentski nalozi — kafić vidi samo svoj meni i narudžbe
          </p>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="btn-glossy flex items-center gap-2 rounded-full bg-gold px-4 py-2.5 text-sm font-semibold text-neutral-900 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Novi korisnik
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-gold-dark" />
        </div>
      ) : (
        <div className="space-y-3">
          {users?.map((user, i) => (
            <motion.div
              key={user.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className={`flex flex-wrap items-center gap-3 rounded-xl border bg-white p-4 shadow-soft ${
                user.isActive ? 'border-ink/8' : 'border-ink/8 opacity-60'
              }`}
            >
              <div
                className={`flex h-11 w-11 items-center justify-center rounded-xl ${
                  user.role === 'superadmin' ? 'bg-gold/15' : 'bg-ink/5'
                }`}
              >
                {user.role === 'superadmin' ? (
                  <ShieldCheck className="h-5 w-5 text-gold-dark" />
                ) : (
                  <Users className="h-5 w-5 text-ink/40" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="truncate font-semibold">{user.name}</h3>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      user.role === 'superadmin'
                        ? 'bg-gold/12 text-gold-dark'
                        : 'bg-ink/5 text-ink/50'
                    }`}
                  >
                    {user.role === 'superadmin' ? 'Superadmin' : 'Klijent'}
                  </span>
                  {!user.isActive && (
                    <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-500">
                      Deaktiviran
                    </span>
                  )}
                </div>
                <p className="truncate text-sm text-ink/45">{user.email}</p>
                {user.venues.length > 0 && (
                  <p className="mt-1 flex items-center gap-1 text-xs text-ink/40">
                    <Store className="h-3 w-3" />
                    {user.venues.map((v) => v.name).join(', ')}
                  </p>
                )}
              </div>

              <button
                onClick={() => setPasswordUser(user)}
                className="flex items-center gap-1.5 rounded-lg bg-ink/5 px-3 py-2 text-xs font-medium text-ink/60 transition-colors hover:bg-gold/10 hover:text-gold-dark"
              >
                <KeyRound className="h-3.5 w-3.5" /> Lozinka
              </button>

              {user.id !== me?.id && (
                <>
                  <button
                    onClick={() => toggleActive.mutate(user)}
                    className={`rounded-lg p-2 transition-colors ${
                      user.isActive
                        ? 'text-ink/40 hover:bg-amber-50 hover:text-amber-600'
                        : 'text-emerald-500 hover:bg-emerald-50'
                    }`}
                    title={user.isActive ? 'Deaktiviraj (odjavljuje korisnika)' : 'Aktiviraj'}
                  >
                    <Power className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Obrisati korisnika "${user.name}"? Njegovi objekti i eventi ostaju.`))
                        deleteUser.mutate(user.id);
                    }}
                    className="rounded-lg p-2 text-ink/40 transition-colors hover:bg-red-50 hover:text-red-500"
                    title="Obriši"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </>
              )}
            </motion.div>
          ))}
        </div>
      )}

      {createOpen && (
        <UserModal
          onClose={() => setCreateOpen(false)}
          onSaved={() => {
            setCreateOpen(false);
            invalidate();
          }}
        />
      )}
      {passwordUser && (
        <PasswordModal
          user={passwordUser}
          onClose={() => setPasswordUser(null)}
          onSaved={() => {
            setPasswordUser(null);
            invalidate();
          }}
        />
      )}
    </div>
  );
}

const inputCls =
  'w-full rounded-lg border border-ink/12 px-3 py-2 text-sm outline-none transition-colors focus:border-gold';

function UserModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'client' | 'superadmin'>('client');
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () =>
      api('/api/users', {
        method: 'POST',
        body: JSON.stringify({ name, email, password, role }),
      }),
    onSuccess: onSaved,
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Greška'),
  });

  return (
    <ModalShell title="Novi korisnik" onClose={onClose}>
      <div className="space-y-3">
        <input autoFocus placeholder="Ime (npr. Caffe Central)" value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
        <input type="email" placeholder="Email (za prijavu)" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
        <input type="text" placeholder="Lozinka (min. 8 znakova)" value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} />
        <div className="grid grid-cols-2 gap-2">
          {(['client', 'superadmin'] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRole(r)}
              className={`rounded-lg border py-2 text-xs font-medium transition-colors ${
                role === r
                  ? 'border-gold bg-gold/10 text-gold-dark'
                  : 'border-ink/10 text-ink/50 hover:border-ink/25'
              }`}
            >
              {r === 'client' ? 'Klijent' : 'Superadmin'}
            </button>
          ))}
        </div>
        <p className="text-xs text-ink/40">
          Nakon kreiranja, dodijelite klijentu objekat u sekciji "Objekti" ili event u "Eventi".
        </p>
      </div>

      {error && <p className="mt-3 text-sm text-red-500">{error}</p>}

      <button
        onClick={() => save.mutate()}
        disabled={!name.trim() || !email.trim() || password.length < 8 || save.isPending}
        className="btn-glossy mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-gold py-2.5 text-sm font-semibold text-neutral-900 transition-colors disabled:opacity-50"
      >
        {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
        Kreiraj korisnika
      </button>
    </ModalShell>
  );
}

function PasswordModal({
  user,
  onClose,
  onSaved,
}: {
  user: UserRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () =>
      api(`/api/users/${user.id}`, { method: 'PATCH', body: JSON.stringify({ password }) }),
    onSuccess: onSaved,
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Greška'),
  });

  return (
    <ModalShell title={`Nova lozinka — ${user.name}`} onClose={onClose}>
      <input
        autoFocus
        type="text"
        placeholder="Nova lozinka (min. 8 znakova)"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className={inputCls}
      />
      <p className="mt-2 text-xs text-ink/40">
        Promjena lozinke odjavljuje korisnika sa svih uređaja.
      </p>
      {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
      <button
        onClick={() => save.mutate()}
        disabled={password.length < 8 || save.isPending}
        className="btn-glossy mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-gold py-2.5 text-sm font-semibold text-neutral-900 transition-colors disabled:opacity-50"
      >
        {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
        Sačuvaj lozinku
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
