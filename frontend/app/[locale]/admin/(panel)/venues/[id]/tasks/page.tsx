'use client';

import { use, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  Loader2,
  X,
  Repeat,
  Clock,
  Trash2,
  CalendarCheck,
  Check,
} from 'lucide-react';
import { api, ApiError, authApi } from '@/lib/api';

interface Occurrence {
  taskId: number;
  date: string; // YYYY-MM-DD
  title: string;
  note: string | null;
  kind: 'task' | 'shift';
  startTime: string | null;
  endTime: string | null;
  recurrence: 'none' | 'daily' | 'weekly' | 'monthly';
  assignee: { id: number; name: string } | null;
  done: boolean;
}

interface StaffMember {
  userId: number;
  name: string;
  role: string;
}

const DAY_NAMES = ['Pon', 'Uto', 'Sri', 'Čet', 'Pet', 'Sub', 'Ned'];
// getDay(): 0=ned … 6=sub — instrumental za "ponavlja se ___"
const WEEKDAY_ADV = ['nedjeljom', 'ponedjeljkom', 'utorkom', 'srijedom', 'četvrtkom', 'petkom', 'subotom'];
const MONTHS = [
  'januar', 'februar', 'mart', 'april', 'maj', 'juni',
  'juli', 'august', 'septembar', 'oktobar', 'novembar', 'decembar',
];

const toDateStr = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

/** Ponedjeljak sedmice u kojoj je datum. */
const mondayOf = (d: Date) => {
  const copy = new Date(d);
  const day = (copy.getDay() + 6) % 7; // pon=0
  copy.setDate(copy.getDate() - day);
  copy.setHours(0, 0, 0, 0);
  return copy;
};

export default function TasksPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: venueId } = use(params);
  const qc = useQueryClient();

  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date()));
  const [modal, setModal] = useState<{ date?: string } | null>(null);
  const [filter, setFilter] = useState<'all' | 'daily' | 'weekly' | 'monthly'>('all');

  const { data: user } = useQuery({ queryKey: ['me'], queryFn: authApi.me, retry: false });
  const isWorker = user?.staff?.role === 'waiter' || user?.staff?.role === 'kitchen';

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      return d;
    }),
    [weekStart]
  );
  const from = toDateStr(days[0]);
  const to = toDateStr(days[6]);
  const todayStr = toDateStr(new Date());

  const { data: occurrences, isLoading } = useQuery({
    queryKey: ['tasks', venueId, from],
    queryFn: () => api<Occurrence[]>(`/api/venues/${venueId}/tasks?from=${from}&to=${to}`),
  });

  const complete = useMutation({
    mutationFn: ({ taskId, date, done }: { taskId: number; date: string; done: boolean }) =>
      api(`/api/tasks/${taskId}/complete`, {
        method: 'POST',
        body: JSON.stringify({ date, done }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks', venueId] }),
  });

  const deleteTask = useMutation({
    mutationFn: (taskId: number) => api(`/api/tasks/${taskId}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks', venueId] }),
  });

  const byDate = useMemo(() => {
    const map = new Map<string, Occurrence[]>();
    const src = (occurrences ?? []).filter((o) => filter === 'all' || o.recurrence === filter);
    for (const occ of src) {
      const list = map.get(occ.date) ?? [];
      list.push(occ);
      map.set(occ.date, list);
    }
    // smjene prve, pa po vremenu
    for (const list of map.values()) {
      list.sort((a, b) =>
        a.kind === b.kind
          ? (a.startTime ?? '99').localeCompare(b.startTime ?? '99')
          : a.kind === 'shift' ? -1 : 1
      );
    }
    return map;
  }, [occurrences, filter]);

  const weekLabel = `${days[0].getDate()}. ${MONTHS[days[0].getMonth()]} – ${days[6].getDate()}. ${MONTHS[days[6].getMonth()]}`;

  return (
    <div>
      {/* Navigacija sedmicama */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setWeekStart((w) => { const d = new Date(w); d.setDate(d.getDate() - 7); return d; })}
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-ink/5 text-ink/60 transition-colors hover:bg-ink/10"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => setWeekStart(mondayOf(new Date()))}
            className="rounded-lg bg-ink/5 px-3.5 py-2 text-sm font-medium text-ink/60 transition-colors hover:bg-ink/10"
          >
            Danas
          </button>
          <button
            onClick={() => setWeekStart((w) => { const d = new Date(w); d.setDate(d.getDate() + 7); return d; })}
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-ink/5 text-ink/60 transition-colors hover:bg-ink/10"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <span className="ml-2 font-display text-lg font-bold">{weekLabel}</span>
        </div>

        {!isWorker && (
          <button
            onClick={() => setModal({})}
            className="btn-glossy flex items-center gap-2 rounded-full bg-gold px-4 py-2.5 text-sm font-semibold text-neutral-900"
          >
            <Plus className="h-4 w-4" />
            Novi zadatak / smjena
          </button>
        )}
      </div>

      {/* Filter po vrsti ponavljanja */}
      <div className="mb-4 flex flex-wrap gap-1.5">
        {([
          { value: 'all', label: 'Svi' },
          { value: 'daily', label: 'Dnevni' },
          { value: 'weekly', label: 'Sedmični' },
          { value: 'monthly', label: 'Mjesečni' },
        ] as const).map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              filter === f.value
                ? 'bg-ink text-cream'
                : 'bg-ink/5 text-ink/55 hover:bg-ink/10'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-gold-dark" />
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
          {days.map((day) => {
            const dateStr = toDateStr(day);
            const list = byDate.get(dateStr) ?? [];
            const isToday = dateStr === todayStr;
            return (
              <div
                key={dateStr}
                className={`flex min-h-[10rem] flex-col rounded-xl border p-3 ${
                  isToday ? 'border-gold/50 bg-gold/[0.04]' : 'border-ink/8 bg-white'
                }`}
              >
                <div className="mb-2.5 flex items-center justify-between">
                  <span
                    className={`text-xs font-bold uppercase tracking-wider ${
                      isToday ? 'text-gold-dark' : 'text-ink/40'
                    }`}
                  >
                    {DAY_NAMES[(day.getDay() + 6) % 7]} {day.getDate()}.
                  </span>
                  {!isWorker && (
                    <button
                      onClick={() => setModal({ date: dateStr })}
                      className="rounded p-1 text-ink/25 transition-colors hover:bg-gold/10 hover:text-gold-dark"
                      title="Dodaj za ovaj dan"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex-1 space-y-1.5">
                  <AnimatePresence initial={false}>
                    {list.map((occ) => (
                      <motion.div
                        key={`${occ.taskId}-${occ.date}`}
                        layout
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className={`group rounded-lg border p-2 text-xs transition-colors ${
                          occ.kind === 'shift'
                            ? 'border-gold/30 bg-gold/8'
                            : occ.done
                              ? 'border-emerald-100 bg-emerald-50'
                              : 'border-ink/8 bg-cream-dark/40'
                        }`}
                      >
                        <div className="flex items-start gap-1.5">
                          {occ.kind === 'task' && (
                            <button
                              onClick={() =>
                                complete.mutate({ taskId: occ.taskId, date: occ.date, done: !occ.done })
                              }
                              className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                                occ.done
                                  ? 'border-emerald-500 bg-emerald-500 text-[#fff]'
                                  : 'border-ink/25 hover:border-gold'
                              }`}
                            >
                              {occ.done && <Check className="h-3 w-3" />}
                            </button>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className={`font-semibold leading-snug ${occ.done ? 'text-ink/40 line-through' : ''}`}>
                              {occ.title}
                            </p>
                            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-ink/45">
                              {occ.kind === 'shift' && occ.startTime && (
                                <span className="flex items-center gap-0.5 font-semibold text-gold-dark">
                                  <Clock className="h-2.5 w-2.5" />
                                  {occ.startTime}–{occ.endTime}
                                </span>
                              )}
                              <span>{occ.assignee ? occ.assignee.name : 'Svi'}</span>
                              {occ.recurrence !== 'none' && <Repeat className="h-2.5 w-2.5" />}
                            </div>
                          </div>
                          {!isWorker && (
                            <button
                              onClick={() => {
                                if (confirm(`Obrisati "${occ.title}"${occ.recurrence !== 'none' ? ' (sva ponavljanja)' : ''}?`))
                                  deleteTask.mutate(occ.taskId);
                              }}
                              className="rounded p-0.5 text-ink/20 opacity-0 transition-all hover:text-red-500 group-hover:opacity-100"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  {list.length === 0 && (
                    <p className="pt-3 text-center text-[10px] text-ink/20">—</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!occurrences?.length && !isLoading && (
        <div className="mt-6 rounded-xl border border-dashed border-ink/15 py-10 text-center">
          <CalendarCheck className="mx-auto mb-2 h-7 w-7 text-ink/20" />
          <p className="text-sm text-ink/40">
            {isWorker
              ? 'Nemaš zadataka za ovu sedmicu.'
              : 'Nema zadataka. Dodaj prvi — npr. "Jutarnja smjena" ili "Naručiti mlijeko".'}
          </p>
        </div>
      )}

      {modal && (
        <TaskModal
          venueId={venueId}
          defaultDate={modal.date}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            qc.invalidateQueries({ queryKey: ['tasks', venueId] });
          }}
        />
      )}
    </div>
  );
}

// ================================================================
// Modal: novi zadatak / smjena
// ================================================================

function TaskModal({
  venueId,
  defaultDate,
  onClose,
  onSaved,
}: {
  venueId: string;
  defaultDate?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [kind, setKind] = useState<'task' | 'shift'>('task');
  const [date, setDate] = useState(defaultDate ?? toDateStr(new Date()));
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('16:00');
  const [assignee, setAssignee] = useState('');
  const [recurrence, setRecurrence] = useState<'none' | 'daily' | 'weekly' | 'monthly'>('none');
  const [until, setUntil] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { data: staff } = useQuery({
    queryKey: ['staff', venueId],
    queryFn: () => api<StaffMember[]>(`/api/venues/${venueId}/staff`),
  });

  const save = useMutation({
    mutationFn: () =>
      api(`/api/venues/${venueId}/tasks`, {
        method: 'POST',
        body: JSON.stringify({
          title,
          note,
          kind,
          date,
          startTime: kind === 'shift' ? startTime : '',
          endTime: kind === 'shift' ? endTime : '',
          assigneeUserId: assignee ? Number(assignee) : null,
          recurrence,
          recurrenceUntil: recurrence !== 'none' && until ? until : null,
        }),
      }),
    onSuccess: onSaved,
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Greška'),
  });

  const input =
    'w-full rounded-lg border border-ink/12 px-3 py-2 text-sm outline-none transition-colors focus:border-gold';

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
          <h3 className="font-display text-lg font-bold">
            {kind === 'shift' ? 'Nova smjena' : 'Novi zadatak'}
          </h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-ink/40 hover:bg-ink/5 hover:text-ink">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3">
          {/* Vrsta */}
          <div className="grid grid-cols-2 gap-2">
            {([
              { value: 'task', label: '✅ Zadatak' },
              { value: 'shift', label: '📅 Smjena' },
            ] as const).map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setKind(option.value)}
                className={`rounded-lg border py-2.5 text-sm font-semibold transition-colors ${
                  kind === option.value
                    ? 'border-gold bg-gold/10 text-gold-dark'
                    : 'border-ink/10 text-ink/45 hover:border-ink/25'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          <input
            autoFocus
            placeholder={kind === 'shift' ? 'Naziv (npr. Jutarnja smjena)' : 'Šta treba uraditi?'}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={input}
          />
          <textarea
            placeholder="Napomena (opcionalno)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            className={`${input} resize-none`}
          />

          <div className="flex gap-2">
            <label className="flex-1">
              <span className="mb-1 block text-xs font-medium text-ink/50">Datum</span>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={input} />
            </label>
            {kind === 'shift' && (
              <>
                <label className="w-24">
                  <span className="mb-1 block text-xs font-medium text-ink/50">Od</span>
                  <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className={input} />
                </label>
                <label className="w-24">
                  <span className="mb-1 block text-xs font-medium text-ink/50">Do</span>
                  <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className={input} />
                </label>
              </>
            )}
          </div>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-ink/50">Zaduženi</span>
            <select value={assignee} onChange={(e) => setAssignee(e.target.value)} className={`${input} bg-white`}>
              <option value="">👥 Svi radnici</option>
              {staff?.map((member) => (
                <option key={member.userId} value={member.userId}>
                  {member.name} ({member.role === 'waiter' ? 'konobar' : member.role === 'kitchen' ? 'kuhinja' : 'šef'})
                </option>
              ))}
            </select>
          </label>

          <div className="flex gap-2">
            <label className="flex-1">
              <span className="mb-1 block text-xs font-medium text-ink/50">Ponavljanje</span>
              <select
                value={recurrence}
                onChange={(e) => setRecurrence(e.target.value as typeof recurrence)}
                className={`${input} bg-white`}
              >
                <option value="none">Bez ponavljanja</option>
                <option value="daily">Svaki dan</option>
                <option value="weekly">Svake sedmice</option>
                <option value="monthly">Svaki mjesec</option>
              </select>
            </label>
            {recurrence !== 'none' && (
              <label className="flex-1">
                <span className="mb-1 block text-xs font-medium text-ink/50">Do (opcionalno)</span>
                <input type="date" value={until} onChange={(e) => setUntil(e.target.value)} className={input} />
              </label>
            )}
          </div>

          {recurrence !== 'none' && (
            <p className="flex items-center gap-1.5 rounded-lg bg-gold/8 px-3 py-2 text-xs text-ink/60">
              <Repeat className="h-3.5 w-3.5 shrink-0 text-gold-dark" />
              {recurrence === 'daily'
                ? 'Ponavlja se svaki dan.'
                : recurrence === 'weekly'
                  ? `Ponavlja se svake sedmice — ${WEEKDAY_ADV[new Date(date + 'T00:00:00').getDay()]}.`
                  : `Ponavlja se svaki mjesec — ${new Date(date + 'T00:00:00').getDate()}. u mjesecu.`}
            </p>
          )}
        </div>

        {error && <p className="mt-3 text-sm text-red-500">{error}</p>}

        <button
          onClick={() => save.mutate()}
          disabled={!title.trim() || save.isPending}
          className="btn-glossy mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-gold py-2.5 text-sm font-semibold text-neutral-900 disabled:opacity-50"
        >
          {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Sačuvaj
        </button>
      </motion.div>
    </motion.div>
  );
}
