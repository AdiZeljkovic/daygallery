'use client';

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'motion/react';
import {
  BellRing,
  Clock,
  Check,
  CheckCheck,
  X,
  Loader2,
  CalendarCheck,
  Sun,
} from 'lucide-react';
import type { OrderDTO, OrderStatus } from '@platform/shared';
import { Link } from '@/i18n/navigation';
import { api, authApi } from '@/lib/api';

interface Occurrence {
  taskId: number;
  date: string;
  title: string;
  note: string | null;
  kind: 'task' | 'shift';
  startTime: string | null;
  endTime: string | null;
  assignee: { id: number; name: string } | null;
  done: boolean;
}

const toDateStr = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export default function StaffHomePage() {
  const qc = useQueryClient();
  const todayStr = toDateStr(new Date());

  const { data: user } = useQuery({ queryKey: ['me'], queryFn: authApi.me, retry: false });
  const venueId = user?.staff?.venueId;
  const isKitchen = user?.staff?.role === 'kitchen';

  // Današnji taskovi i smjene
  const { data: occurrences } = useQuery({
    queryKey: ['tasks', String(venueId), todayStr, 'today'],
    queryFn: () => api<Occurrence[]>(`/api/venues/${venueId}/tasks?from=${todayStr}&to=${todayStr}`),
    enabled: !!venueId,
  });

  // Aktivne narudžbe (nove + u pripremi)
  const { data: orders, isLoading: ordersLoading } = useQuery({
    queryKey: ['orders', venueId, 'active'],
    queryFn: () => api<OrderDTO[]>(`/api/venues/${venueId}/orders`),
    enabled: !!venueId,
    refetchInterval: 30_000,
  });

  const complete = useMutation({
    mutationFn: ({ taskId, done }: { taskId: number; done: boolean }) =>
      api(`/api/tasks/${taskId}/complete`, {
        method: 'POST',
        body: JSON.stringify({ date: todayStr, done }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  });

  const setStatus = useMutation({
    mutationFn: ({ orderId, status }: { orderId: number; status: OrderStatus }) =>
      api(`/api/orders/${orderId}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['orders'] }),
  });

  const shifts = useMemo(() => occurrences?.filter((o) => o.kind === 'shift') ?? [], [occurrences]);
  const tasks = useMemo(() => occurrences?.filter((o) => o.kind === 'task') ?? [], [occurrences]);
  const activeOrders = useMemo(
    () =>
      (orders ?? []).filter((o) =>
        isKitchen ? o.status === 'accepted' : o.status === 'pending' || o.status === 'accepted'
      ),
    [orders, isKitchen]
  );

  if (!user) return null;

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold">
          Zdravo, {user.name.split(' ')[0]} 👋
        </h1>
        <p className="mt-1 text-sm text-ink/50">
          {new Date().toLocaleDateString('bs-BA', { weekday: 'long', day: 'numeric', month: 'long' })}
          {user.staff?.venueName && ` · ${user.staff.venueName}`}
        </p>
      </div>

      {/* Današnja smjena */}
      {shifts.length > 0 && (
        <div className="mb-6 space-y-2">
          {shifts.map((shift) => (
            <div
              key={`${shift.taskId}-${shift.date}`}
              className="flex items-center gap-3 rounded-xl border border-gold/40 bg-gold/8 px-4 py-3"
            >
              <Sun className="h-5 w-5 shrink-0 text-gold-dark" />
              <div className="flex-1">
                <p className="font-semibold">{shift.title}</p>
                {shift.note && <p className="text-xs text-ink/50">{shift.note}</p>}
              </div>
              {shift.startTime && (
                <span className="flex items-center gap-1.5 rounded-full bg-gold px-3 py-1.5 text-sm font-bold text-neutral-900">
                  <Clock className="h-3.5 w-3.5" />
                  {shift.startTime}–{shift.endTime}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Aktivne narudžbe */}
      <section className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-display text-xl font-bold">
            <BellRing className="h-5 w-5 text-gold-dark" />
            {isKitchen ? 'Za pripremu' : 'Aktivne narudžbe'}
            {activeOrders.length > 0 && (
              <span className="rounded-full bg-amber-400 px-2 py-0.5 text-xs font-bold text-neutral-900">
                {activeOrders.length}
              </span>
            )}
          </h2>
          {venueId && (
            <Link
              href={`/admin/venues/${venueId}/orders`}
              className="text-xs font-medium text-gold-dark hover:underline"
            >
              Sve narudžbe →
            </Link>
          )}
        </div>

        {ordersLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-gold-dark" />
          </div>
        ) : activeOrders.length === 0 ? (
          <div className="rounded-xl border border-dashed border-ink/15 py-10 text-center text-sm text-ink/40">
            {isKitchen ? 'Trenutno nema narudžbi za pripremu. ☕' : 'Nema aktivnih narudžbi. ☕'}
          </div>
        ) : (
          <div className="space-y-3">
            <AnimatePresence initial={false}>
              {activeOrders.map((order) => (
                <motion.div
                  key={order.id}
                  layout
                  initial={{ opacity: 0, y: -14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  className={`rounded-xl border bg-white p-4 shadow-soft ${
                    order.status === 'pending' ? 'border-amber-50' : 'border-ink/8'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-ink font-display text-xl font-bold text-cream">
                      {order.tableNumber}
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold">Sto {order.tableNumber}</p>
                      <p className="text-xs text-ink/45">
                        {new Date(order.createdAt).toLocaleTimeString('bs-BA', { hour: '2-digit', minute: '2-digit' })}
                        {' · '}
                        {order.status === 'pending' ? 'Čeka potvrdu' : 'U pripremi'}
                      </p>
                    </div>
                    <span className="font-display text-lg font-bold">{order.total}</span>
                  </div>

                  <div className="mt-3 space-y-1 border-t border-ink/5 pt-2.5">
                    {order.items.map((item, i) => (
                      <p key={i} className="text-base">
                        <span className="font-bold text-gold-dark">{item.quantity}×</span> {item.name}
                      </p>
                    ))}
                    {order.note && (
                      <p className="mt-1 rounded-lg bg-amber-50 px-2.5 py-1.5 text-sm text-amber-800">
                        💬 {order.note}
                      </p>
                    )}
                  </div>

                  <div className="mt-3">
                    {order.status === 'pending' ? (
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => setStatus.mutate({ orderId: order.id, status: 'accepted' })}
                          className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-500 py-3 font-semibold text-[#fff] transition-colors hover:bg-emerald-600"
                        >
                          <Check className="h-5 w-5" /> Prihvati
                        </button>
                        <button
                          onClick={() => setStatus.mutate({ orderId: order.id, status: 'rejected' })}
                          className="flex items-center justify-center gap-1.5 rounded-xl border border-red-200 py-3 font-semibold text-red-500 transition-colors hover:bg-red-50"
                        >
                          <X className="h-5 w-5" /> Odbij
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setStatus.mutate({ orderId: order.id, status: 'completed' })}
                        className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-ink py-3 font-semibold text-cream transition-colors hover:bg-ink-soft"
                      >
                        <CheckCheck className="h-5 w-5" /> {isKitchen ? 'Spremno' : 'Završeno'}
                      </button>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </section>

      {/* Današnji zadaci */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 font-display text-xl font-bold">
          <CalendarCheck className="h-5 w-5 text-gold-dark" />
          Moji zadaci danas
        </h2>
        {tasks.length === 0 ? (
          <div className="rounded-xl border border-dashed border-ink/15 py-10 text-center text-sm text-ink/40">
            Nema zadataka za danas. 🎉
          </div>
        ) : (
          <div className="space-y-2">
            {tasks.map((task) => (
              <button
                key={`${task.taskId}-${task.date}`}
                onClick={() => complete.mutate({ taskId: task.taskId, done: !task.done })}
                className={`flex w-full items-center gap-3 rounded-xl border p-4 text-left transition-colors ${
                  task.done
                    ? 'border-emerald-100 bg-emerald-50'
                    : 'border-ink/8 bg-white hover:border-gold/40'
                }`}
              >
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border-2 transition-colors ${
                    task.done ? 'border-emerald-500 bg-emerald-500 text-[#fff]' : 'border-ink/25'
                  }`}
                >
                  {task.done && <Check className="h-4 w-4" />}
                </span>
                <span className="flex-1">
                  <span className={`block font-medium ${task.done ? 'text-ink/40 line-through' : ''}`}>
                    {task.title}
                  </span>
                  {task.note && <span className="text-xs text-ink/45">{task.note}</span>}
                </span>
                <span className="text-xs text-ink/35">{task.assignee ? task.assignee.name : 'Svi'}</span>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
