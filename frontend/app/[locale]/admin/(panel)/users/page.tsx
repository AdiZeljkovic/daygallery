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
  UsersRound,
  ChefHat,
  Coffee,
  SlidersHorizontal,
  RotateCcw,
} from 'lucide-react';
import {
  PANEL_MODULES,
  PANEL_MODULE_LABELS,
  DEFAULT_MODULE_PERMS,
  type PanelModule,
  type StaffRole,
} from '@platform/shared';
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

interface GroupMember {
  id: number;
  role: StaffRole;
  permissions: Record<PanelModule, boolean> | null;
  userId: number;
  name: string;
  email: string;
  isActive: boolean;
}

interface GroupRow {
  id: number;
  name: string;
  venues: { id: number; name: string }[];
  members: GroupMember[];
}

const ROLE_META: Record<StaffRole, { label: string; icon: typeof ChefHat; tint: string }> = {
  manager: { label: 'Šef', icon: ShieldCheck, tint: 'bg-gold/12 text-gold-dark' },
  waiter: { label: 'Konobar', icon: Coffee, tint: 'bg-emerald-50 text-emerald-600' },
  kitchen: { label: 'Šank & Kuhinja', icon: ChefHat, tint: 'bg-amber-50 text-amber-700' },
};

export default function UsersPage() {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [passwordUser, setPasswordUser] = useState<UserRow | null>(null);
  const [groupModal, setGroupModal] = useState(false);
  const [memberModalGroup, setMemberModalGroup] = useState<GroupRow | null>(null);

  const { data: me } = useQuery({ queryKey: ['me'], queryFn: authApi.me, retry: false });
  const { data: users, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => api<UserRow[]>('/api/users'),
  });
  const { data: groups } = useQuery({
    queryKey: ['groups'],
    queryFn: () => api<GroupRow[]>('/api/groups'),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['users'] });
  const invalidateGroups = () => qc.invalidateQueries({ queryKey: ['groups'] });

  const deleteGroup = useMutation({
    mutationFn: (id: number) => api(`/api/groups/${id}`, { method: 'DELETE' }),
    onSuccess: invalidateGroups,
  });

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
      {/* ============ GRUPE LOKALA ============ */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold">Grupe lokala</h1>
          <p className="mt-1 text-sm text-ink/50">
            Ekipa jednog kafića (Šef / Konobar / Šank & Kuhinja) — grupu dodijeliš objektu u
            „Objekti → Uredi", a ovdje po članu biraš čemu ima pristup.
          </p>
        </div>
        <button
          onClick={() => setGroupModal(true)}
          className="btn-glossy flex items-center gap-2 rounded-full bg-gold px-4 py-2.5 text-sm font-semibold text-neutral-900 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Nova grupa
        </button>
      </div>

      <div className="mb-12 space-y-4">
        {!groups?.length ? (
          <div className="rounded-2xl border border-dashed border-ink/15 py-12 text-center">
            <UsersRound className="mx-auto mb-2 h-7 w-7 text-ink/20" />
            <p className="text-sm text-ink/40">
              Nema grupa. Kreiraj grupu za kafić, dodaj naloge, pa je dodijeli objektu.
            </p>
          </div>
        ) : (
          groups.map((group) => (
            <GroupCard
              key={group.id}
              group={group}
              onAddMember={() => setMemberModalGroup(group)}
              onDelete={() => {
                if (
                  confirm(
                    `Obrisati grupu "${group.name}"? Objekti gube dodjelu, a nalozi članova (bez drugih veza) se brišu.`
                  )
                )
                  deleteGroup.mutate(group.id);
              }}
              onChanged={invalidateGroups}
            />
          ))
        )}
      </div>

      {/* ============ KORISNICI ============ */}
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
      {groupModal && (
        <GroupModal
          onClose={() => setGroupModal(false)}
          onSaved={() => {
            setGroupModal(false);
            invalidateGroups();
          }}
        />
      )}
      {memberModalGroup && (
        <MemberModal
          group={memberModalGroup}
          onClose={() => setMemberModalGroup(null)}
          onSaved={() => {
            setMemberModalGroup(null);
            invalidateGroups();
          }}
        />
      )}
    </div>
  );
}

const inputCls =
  'w-full rounded-lg border border-ink/12 px-3 py-2 text-sm outline-none transition-colors focus:border-gold';

// ================================================================
// Grupe lokala
// ================================================================

function GroupCard({
  group,
  onAddMember,
  onDelete,
  onChanged,
}: {
  group: GroupRow;
  onAddMember: () => void;
  onDelete: () => void;
  onChanged: () => void;
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-ink/8 bg-white p-5 shadow-soft"
    >
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gold/12">
          <UsersRound className="h-5 w-5 text-gold-dark" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-display text-lg font-bold">{group.name}</h3>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-ink/45">
            {group.venues.length ? (
              group.venues.map((v) => (
                <span key={v.id} className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 font-medium text-emerald-600">
                  <Store className="h-3 w-3" /> {v.name}
                </span>
              ))
            ) : (
              <span className="rounded-full bg-amber-50 px-2 py-0.5 font-medium text-amber-700">
                Nije dodijeljena objektu — uradi to u „Objekti → Uredi"
              </span>
            )}
          </div>
        </div>
        <button
          onClick={onAddMember}
          className="flex items-center gap-1.5 rounded-full bg-gold/12 px-3.5 py-2 text-xs font-semibold text-gold-dark transition-colors hover:bg-gold/25"
        >
          <Plus className="h-3.5 w-3.5" /> Dodaj nalog
        </button>
        <button
          onClick={onDelete}
          className="rounded-lg p-2 text-ink/35 transition-colors hover:bg-red-50 hover:text-red-500"
          title="Obriši grupu"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {group.members.length > 0 && (
        <div className="mt-4 space-y-2 border-t border-ink/6 pt-4">
          {group.members.map((m) => (
            <MemberRow key={m.id} member={m} onChanged={onChanged} />
          ))}
        </div>
      )}
    </motion.div>
  );
}

function MemberRow({ member, onChanged }: { member: GroupMember; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const meta = ROLE_META[member.role];
  const effective = { ...DEFAULT_MODULE_PERMS[member.role], ...(member.permissions ?? {}) };
  const isCustom = member.permissions !== null;

  const patch = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      api(`/api/groups/members/${member.id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    onSuccess: onChanged,
  });

  const remove = useMutation({
    mutationFn: () => api(`/api/groups/members/${member.id}`, { method: 'DELETE' }),
    onSuccess: onChanged,
  });

  const togglePerm = (mod: PanelModule) =>
    patch.mutate({ permissions: { ...effective, [mod]: !effective[mod] } });

  return (
    <div className="rounded-xl border border-ink/8 bg-ink/[0.015] p-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${meta.tint}`}>
          <meta.icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold">{member.name}</p>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${meta.tint}`}>
              {meta.label}
            </span>
            {isCustom && (
              <span className="rounded-full bg-ink/6 px-2 py-0.5 text-[10px] font-semibold text-ink/50">
                Prilagođen pristup
              </span>
            )}
          </div>
          <p className="truncate text-xs text-ink/45">{member.email}</p>
        </div>
        <button
          onClick={() => setOpen((o) => !o)}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
            open ? 'bg-gold/15 text-gold-dark' : 'bg-ink/5 text-ink/60 hover:bg-gold/10 hover:text-gold-dark'
          }`}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" /> Pristup
        </button>
        <button
          onClick={() => {
            if (confirm(`Ukloniti "${member.name}" iz grupe? Nalog bez drugih veza se briše.`))
              remove.mutate();
          }}
          className="rounded-lg p-2 text-ink/35 transition-colors hover:bg-red-50 hover:text-red-500"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {open && (
        <div className="mt-3 border-t border-ink/6 pt-3">
          <div className="flex flex-wrap gap-2">
            {PANEL_MODULES.map((mod) => (
              <button
                key={mod}
                onClick={() => togglePerm(mod)}
                disabled={patch.isPending}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                  effective[mod]
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    : 'border-ink/10 bg-white text-ink/40 hover:border-ink/25'
                }`}
              >
                {effective[mod] ? '✓ ' : ''}
                {PANEL_MODULE_LABELS[mod]}
              </button>
            ))}
            {isCustom && (
              <button
                onClick={() => patch.mutate({ permissions: null })}
                disabled={patch.isPending}
                className="flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium text-ink/45 hover:bg-ink/5"
                title="Vrati na default po roli"
              >
                <RotateCcw className="h-3 w-3" /> Default po roli
              </button>
            )}
          </div>
          <p className="mt-2 text-[11px] text-ink/40">
            Moduli kojima nalog pristupa u panelu. Default za {meta.label}:{' '}
            {PANEL_MODULES.filter((m) => DEFAULT_MODULE_PERMS[member.role][m])
              .map((m) => PANEL_MODULE_LABELS[m])
              .join(', ')}
            .
          </p>
        </div>
      )}
    </div>
  );
}

function GroupModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () => api('/api/groups', { method: 'POST', body: JSON.stringify({ name }) }),
    onSuccess: onSaved,
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Greška'),
  });

  return (
    <ModalShell title="Nova grupa lokala" onClose={onClose}>
      <input
        autoFocus
        placeholder="Naziv (npr. Caffe Central ekipa)"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className={inputCls}
      />
      <p className="mt-2 text-xs text-ink/40">
        Nakon kreiranja dodaj naloge (Šef / Konobar / Šank & Kuhinja), pa grupu dodijeli objektu u
        „Objekti → Uredi objekat".
      </p>
      {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
      <button
        onClick={() => save.mutate()}
        disabled={!name.trim() || save.isPending}
        className="btn-glossy mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-gold py-2.5 text-sm font-semibold text-neutral-900 disabled:opacity-50"
      >
        {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
        Kreiraj grupu
      </button>
    </ModalShell>
  );
}

function MemberModal({
  group,
  onClose,
  onSaved,
}: {
  group: GroupRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<StaffRole>('waiter');
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () =>
      api(`/api/groups/${group.id}/members`, {
        method: 'POST',
        body: JSON.stringify({ name, email, password, role }),
      }),
    onSuccess: onSaved,
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Greška'),
  });

  return (
    <ModalShell title={`Novi nalog — ${group.name}`} onClose={onClose}>
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
            Default pristup:{' '}
            {PANEL_MODULES.filter((m) => DEFAULT_MODULE_PERMS[role][m])
              .map((m) => PANEL_MODULE_LABELS[m])
              .join(', ')}{' '}
            — mijenjaš po članu kroz „Pristup".
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
