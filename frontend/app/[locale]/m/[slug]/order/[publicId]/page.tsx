'use client';

import { use, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'motion/react';
import { Check, ChefHat, PartyPopper, XCircle, Loader2, ArrowLeft, Receipt } from 'lucide-react';
import type { OrderDTO, OrderStatus } from '@platform/shared';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { getSocket } from '@/lib/socket';

type OrderView = OrderDTO & { venueName: string; currency: string };

const STEPS: { status: OrderStatus; label: string; icon: typeof Check }[] = [
  { status: 'pending', label: 'Poslano', icon: Receipt },
  { status: 'accepted', label: 'U pripremi', icon: ChefHat },
  { status: 'completed', label: 'Gotovo', icon: PartyPopper },
];

const STEP_INDEX: Record<OrderStatus, number> = {
  pending: 0,
  accepted: 1,
  completed: 2,
  rejected: -1,
};

export default function OrderStatusPage({
  params,
}: {
  params: Promise<{ slug: string; publicId: string }>;
}) {
  const { slug, publicId } = use(params);
  const qc = useQueryClient();

  const { data: order, isLoading } = useQuery({
    queryKey: ['order', publicId],
    queryFn: () => api<OrderView>(`/api/public/orders/${publicId}`),
    refetchInterval: (q) =>
      // polling fallback dok narudžba nije završena
      q.state.data?.status === 'completed' || q.state.data?.status === 'rejected' ? false : 10_000,
  });

  // Socket: live status update
  useEffect(() => {
    const socket = getSocket();
    const subscribe = () => socket.emit('order:subscribe', publicId);
    if (socket.connected) subscribe();
    socket.on('connect', subscribe);

    const onStatus = (updated: OrderDTO) => {
      if (updated.publicId === publicId) {
        qc.setQueryData<OrderView>(['order', publicId], (old) =>
          old ? { ...old, ...updated } : old
        );
      }
    };
    socket.on('order:status', onStatus);
    return () => {
      socket.off('connect', subscribe);
      socket.off('order:status', onStatus);
    };
  }, [publicId, qc]);

  if (isLoading || !order) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-ink">
        <Loader2 className="h-7 w-7 animate-spin text-gold" />
      </main>
    );
  }

  const stepIndex = STEP_INDEX[order.status];
  const rejected = order.status === 'rejected';

  return (
    <main className="flex min-h-screen flex-col items-center bg-ink px-6 py-10 text-cream">
      <div className="w-full max-w-md">
        <Link
          href={`/m/${slug}`}
          className="mb-8 inline-flex items-center gap-1.5 text-sm text-cream/50 transition-colors hover:text-cream"
        >
          <ArrowLeft className="h-4 w-4" /> Nazad na meni
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <p className="text-xs uppercase tracking-[0.25em] text-cream/40">{order.venueName}</p>
          <h1 className="mt-2 font-display text-2xl font-bold">
            Narudžba · Sto {order.tableNumber}
          </h1>
        </motion.div>

        {/* Status koraci */}
        {rejected ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mt-10 rounded-2xl border border-red-500/25 bg-red-500/10 p-6 text-center"
          >
            <XCircle className="mx-auto mb-3 h-10 w-10 text-red-400" />
            <p className="font-semibold text-red-300">Narudžba je odbijena</p>
            <p className="mt-1 text-sm text-cream/50">
              Žao nam je — obratite se osoblju za više informacija.
            </p>
          </motion.div>
        ) : (
          <div className="mt-10 flex items-center justify-between px-2">
            {STEPS.map((step, i) => {
              const Icon = step.icon;
              const reached = stepIndex >= i;
              const current = stepIndex === i && order.status !== 'completed';
              return (
                <div key={step.status} className="flex flex-1 items-center last:flex-none">
                  <div className="flex flex-col items-center">
                    <motion.div
                      animate={
                        current
                          ? { scale: [1, 1.08, 1], transition: { repeat: Infinity, duration: 1.8 } }
                          : {}
                      }
                      className={`flex h-12 w-12 items-center justify-center rounded-full border-2 transition-colors duration-500 ${
                        reached
                          ? 'border-gold bg-gold text-ink'
                          : 'border-cream/15 bg-transparent text-cream/25'
                      }`}
                    >
                      <AnimatePresence mode="wait">
                        <motion.span
                          key={reached && i < stepIndex ? 'done' : step.status}
                          initial={{ scale: 0, rotate: -90 }}
                          animate={{ scale: 1, rotate: 0 }}
                          transition={{ type: 'spring', stiffness: 400, damping: 22 }}
                        >
                          {reached && i < stepIndex ? (
                            <Check className="h-5 w-5" />
                          ) : (
                            <Icon className="h-5 w-5" />
                          )}
                        </motion.span>
                      </AnimatePresence>
                    </motion.div>
                    <span
                      className={`mt-2 text-xs font-medium transition-colors ${
                        reached ? 'text-gold' : 'text-cream/30'
                      }`}
                    >
                      {step.label}
                    </span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className="relative mx-2 mb-6 h-0.5 flex-1 overflow-hidden rounded bg-cream/10">
                      <motion.div
                        className="absolute inset-y-0 left-0 bg-gold"
                        initial={{ width: 0 }}
                        animate={{ width: stepIndex > i ? '100%' : '0%' }}
                        transition={{ duration: 0.6, ease: 'easeOut' }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Poruka statusa */}
        {!rejected && (
          <motion.p
            key={order.status}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-6 text-center text-sm text-cream/55"
          >
            {order.status === 'pending' && 'Čekamo da osoblje potvrdi vašu narudžbu...'}
            {order.status === 'accepted' && 'Narudžba je prihvaćena i priprema se! 🎉'}
            {order.status === 'completed' && 'Narudžba je završena. Prijatno! ☕'}
          </motion.p>
        )}

        {/* Račun */}
        <div className="mt-10 rounded-2xl border border-cream/10 bg-cream/[0.04] p-5">
          <div className="space-y-2">
            {order.items.map((item, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span className="text-cream/80">
                  <span className="font-semibold text-gold">{item.quantity}×</span> {item.name}
                </span>
                <span className="text-cream/55">
                  {item.lineTotal} {order.currency}
                </span>
              </div>
            ))}
          </div>
          {order.note && (
            <p className="mt-3 rounded-lg bg-cream/5 px-3 py-2 text-xs text-cream/50">
              💬 {order.note}
            </p>
          )}
          <div className="mt-4 flex justify-between border-t border-cream/10 pt-3 font-bold">
            <span>Ukupno</span>
            <span className="text-gold">
              {order.total} {order.currency}
            </span>
          </div>
        </div>
      </div>
    </main>
  );
}
