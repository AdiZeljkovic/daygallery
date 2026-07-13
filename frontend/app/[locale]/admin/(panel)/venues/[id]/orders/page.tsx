'use client';

import { use, useEffect, useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'motion/react';
import {
  BellRing,
  Check,
  X,
  CheckCheck,
  Volume2,
  VolumeX,
  Loader2,
  Clock,
  Wifi,
  WifiOff,
} from 'lucide-react';
import type { OrderDTO, OrderStatus } from '@platform/shared';
import { api } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { unlockAudio, playNewOrderChime } from '@/lib/notificationSound';

const STATUS_META: Record<OrderStatus, { label: string; className: string }> = {
  pending: { label: 'Nova', className: 'bg-amber-100 text-amber-700' },
  accepted: { label: 'Prihvaćena', className: 'bg-emerald-100 text-emerald-700' },
  rejected: { label: 'Odbijena', className: 'bg-red-100 text-red-600' },
  completed: { label: 'Završena', className: 'bg-ink/8 text-ink/55' },
};

const FILTERS: { value: OrderStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'Sve' },
  { value: 'pending', label: 'Nove' },
  { value: 'accepted', label: 'U pripremi' },
  { value: 'completed', label: 'Završene' },
  { value: 'rejected', label: 'Odbijene' },
];

export default function OrdersDashboardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: venueIdStr } = use(params);
  const venueId = Number(venueIdStr);
  const qc = useQueryClient();

  const [filter, setFilter] = useState<OrderStatus | 'all'>('all');
  const [soundOn, setSoundOn] = useState(false);
  const [connected, setConnected] = useState(false);
  const [flashId, setFlashId] = useState<number | null>(null);

  const { data: orders, isLoading } = useQuery({
    queryKey: ['orders', venueId, filter],
    queryFn: () =>
      api<(OrderDTO & { currency?: string })[]>(
        `/api/venues/${venueId}/orders${filter === 'all' ? '' : `?status=${filter}`}`
      ),
    refetchInterval: 30_000, // fallback ako socket zakaže
  });

  const { data: venue } = useQuery({
    queryKey: ['venue', venueIdStr],
    queryFn: () => api<{ currency: string }>(`/api/venues/${venueIdStr}`),
  });
  const currency = venue?.currency ?? 'BAM';

  const invalidateOrders = useCallback(
    () => qc.invalidateQueries({ queryKey: ['orders', venueId] }),
    [qc, venueId]
  );

  // zvuk toggle iz localStorage
  useEffect(() => {
    if (localStorage.getItem('sd_sound') === 'on' && unlockAudio()) setSoundOn(true);
  }, []);

  const toggleSound = () => {
    if (!soundOn && unlockAudio()) {
      setSoundOn(true);
      localStorage.setItem('sd_sound', 'on');
      playNewOrderChime(); // demo ton kao potvrda
    } else {
      setSoundOn(false);
      localStorage.setItem('sd_sound', 'off');
    }
  };

  // Socket: subscribe na venue sobu, order:new + order:status
  useEffect(() => {
    const socket = getSocket();

    const subscribe = () => {
      socket.emit('venue:subscribe', venueId);
      setConnected(true);
      invalidateOrders(); // reconnect → refetch, ništa se ne gubi
    };

    if (socket.connected) subscribe();
    socket.on('connect', subscribe);
    socket.on('disconnect', () => setConnected(false));

    const onNew = (order: OrderDTO) => {
      if (order.venueId !== venueId) return;
      invalidateOrders();
      setFlashId(order.id);
      setTimeout(() => setFlashId(null), 4000);
      // zvuk i sistemsku notifikaciju svira globalni listener u (panel)/layout.tsx
    };
    const onStatus = (order: OrderDTO) => {
      if (order.venueId !== venueId) return;
      invalidateOrders();
    };

    socket.on('order:new', onNew);
    socket.on('order:status', onStatus);

    // tab se vrati u fokus → refetch (fallback za propuštene evente)
    const onVisible = () => document.visibilityState === 'visible' && invalidateOrders();
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      // NE šaljemo venue:unsubscribe — globalni listener u layoutu drži pretplatu
      // na istu sobu; napuštanjem sobe bi admin prestao dobijati notifikacije
      // o narudžbama sa ostalih stranica panela.
      socket.off('connect', subscribe);
      socket.off('order:new', onNew);
      socket.off('order:status', onStatus);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [venueId, invalidateOrders]);

  const setStatus = async (orderId: number, status: OrderStatus) => {
    await api(`/api/orders/${orderId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    invalidateOrders();
  };

  const pendingCount = orders?.filter((o) => o.status === 'pending').length ?? 0;

  return (
    <div className="max-w-3xl">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
                filter === f.value
                  ? 'bg-ink text-cream'
                  : 'bg-ink/5 text-ink/55 hover:bg-ink/10'
              }`}
            >
              {f.label}
              {f.value === 'pending' && pendingCount > 0 && (
                <span className="ml-1.5 rounded-full bg-amber-400 px-1.5 text-[10px] font-bold text-neutral-900">
                  {pendingCount}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`flex items-center gap-1.5 text-xs ${connected ? 'text-emerald-600' : 'text-red-500'}`}
            title={connected ? 'Real-time veza aktivna' : 'Veza prekinuta — koristi se osvježavanje'}
          >
            {connected ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
            {connected ? 'Uživo' : 'Offline'}
          </span>
          <button
            onClick={toggleSound}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
              soundOn
                ? 'bg-gold/15 text-gold-dark'
                : 'bg-ink/5 text-ink/50 hover:bg-ink/10'
            }`}
          >
            {soundOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            {soundOn ? 'Zvuk uključen' : 'Uključi zvuk'}
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-gold-dark" />
        </div>
      ) : !orders?.length ? (
        <div className="rounded-xl border border-dashed border-ink/15 py-20 text-center">
          <BellRing className="mx-auto mb-3 h-8 w-8 text-ink/20" />
          <p className="text-ink/40">Nema narudžbi{filter !== 'all' ? ' za ovaj filter' : ' još'}.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence initial={false}>
            {orders.map((order) => (
              <motion.div
                key={order.id}
                layout
                initial={{ opacity: 0, y: -16, scale: 0.98 }}
                animate={{
                  opacity: 1,
                  y: 0,
                  scale: 1,
                  boxShadow:
                    flashId === order.id
                      ? '0 0 0 3px rgb(212 175 55 / 0.5), 0 12px 40px rgb(28 27 25 / 0.12)'
                      : '0 2px 24px rgb(28 27 25 / 0.06)',
                }}
                exit={{ opacity: 0, scale: 0.97 }}
                className="rounded-xl border border-ink/8 bg-white p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-ink font-display text-lg font-bold text-cream">
                      {order.tableNumber}
                    </div>
                    <div>
                      <p className="text-sm font-semibold">Sto {order.tableNumber}</p>
                      <p className="flex items-center gap-1 text-xs text-ink/40">
                        <Clock className="h-3 w-3" />
                        {new Date(order.createdAt).toLocaleTimeString('bs-BA', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${STATUS_META[order.status].className}`}
                  >
                    {STATUS_META[order.status].label}
                  </span>
                </div>

                <div className="mt-3 space-y-1 border-t border-ink/5 pt-3">
                  {order.items.map((item, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span>
                        <span className="font-medium text-gold-dark">{item.quantity}×</span>{' '}
                        {item.name}
                      </span>
                      <span className="text-ink/55">{item.lineTotal} {currency}</span>
                    </div>
                  ))}
                  {order.note && (
                    <p className="rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800">
                      💬 {order.note}
                    </p>
                  )}
                  <div className="flex justify-between pt-1.5 text-sm font-bold">
                    <span>Ukupno</span>
                    <span>{order.total} {currency}</span>
                  </div>
                </div>

                {order.status === 'pending' && (
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      onClick={() => setStatus(order.id, 'accepted')}
                      className="flex items-center justify-center gap-1.5 rounded-lg bg-emerald-500 py-2.5 text-sm font-semibold text-[#fff] transition-colors hover:bg-emerald-600"
                    >
                      <Check className="h-4 w-4" />
                      Prihvati
                    </motion.button>
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      onClick={() => setStatus(order.id, 'rejected')}
                      className="flex items-center justify-center gap-1.5 rounded-lg border border-red-200 py-2.5 text-sm font-semibold text-red-500 transition-colors hover:bg-red-50"
                    >
                      <X className="h-4 w-4" />
                      Odbij
                    </motion.button>
                  </div>
                )}
                {order.status === 'accepted' && (
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setStatus(order.id, 'completed')}
                    className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg bg-ink py-2.5 text-sm font-semibold text-cream transition-colors hover:bg-ink-soft"
                  >
                    <CheckCheck className="h-4 w-4" />
                    Označi završenom
                  </motion.button>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
