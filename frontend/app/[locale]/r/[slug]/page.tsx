'use client';

import { use, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'motion/react';
import { Star, Send, Loader2, CheckCircle2, Heart } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { imageUrl } from '@/lib/menuTypes';

const GOLD = '#d4af37';

interface CampaignInfo {
  name: string;
  logoPath: string | null;
  googleReviewUrl: string | null;
  gateEnabled: boolean;
}

export default function PublicReviewPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['publicReview', slug],
    queryFn: () => api<CampaignInfo>(`/api/public/reviews/${slug}`),
    retry: false,
  });

  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [phase, setPhase] = useState<'rate' | 'feedback' | 'done'>('rate');
  const [message, setMessage] = useState('');
  const [contact, setContact] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = (value: number) => {
    setRating(value);
    if (!data?.gateEnabled || value >= 4) {
      if (data?.googleReviewUrl) {
        setTimeout(() => {
          window.location.href = data.googleReviewUrl!;
        }, 500);
      }
      setPhase('done');
    } else {
      setPhase('feedback');
    }
  };

  const submitFeedback = async () => {
    setSending(true);
    setError(null);
    try {
      await api(`/api/public/reviews/${slug}/feedback`, {
        method: 'POST',
        body: JSON.stringify({ rating, message: message.trim(), contact: contact.trim() }),
      });
      setPhase('done');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Slanje nije uspjelo');
      setSending(false);
    }
  };

  const display = hover || rating;

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0b0a08] p-5 text-[#f5f1e8]">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div
          className="absolute -top-40 left-1/2 h-96 w-[40rem] -translate-x-1/2 rounded-full blur-3xl"
          style={{ backgroundColor: `${GOLD}18` }}
        />
      </div>

      <div className="relative w-full max-w-sm">
        {isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin" style={{ color: GOLD }} />
          </div>
        ) : isError || !data ? (
          <div className="rounded-3xl border border-white/10 bg-[#14110d] p-8 text-center">
            <h1 className="font-display text-xl font-bold">Recenzija nije pronađena</h1>
            <p className="mt-2 text-sm opacity-55">Link je možda istekao ili nije ispravan.</p>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            className="rounded-3xl border border-white/10 bg-[#14110d] p-8 text-center shadow-lifted"
          >
            <AnimatePresence mode="wait">
              {phase === 'rate' && (
                <motion.div key="rate" exit={{ opacity: 0 }}>
                  {data.logoPath ? (
                    <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white/5">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={imageUrl(data.logoPath)!} alt="" className="h-full w-full object-cover" />
                    </div>
                  ) : (
                    <div
                      className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl"
                      style={{ backgroundColor: `${GOLD}1a` }}
                    >
                      <Star className="h-7 w-7" style={{ color: GOLD }} />
                    </div>
                  )}
                  <h1 className="font-display text-2xl font-bold">{data.name}</h1>
                  <p className="mx-auto mt-2 max-w-[15rem] text-sm opacity-55">
                    Ocijenite svoje iskustvo s nama. Vaše povratne informacije nam znače!
                  </p>
                  <div className="mt-6 flex justify-center gap-2">
                    {[1, 2, 3, 4, 5].map((v) => (
                      <button
                        key={v}
                        onMouseEnter={() => setHover(v)}
                        onMouseLeave={() => setHover(0)}
                        onClick={() => pick(v)}
                        className="p-1 transition-transform hover:scale-110"
                        aria-label={`${v} zvjezdica`}
                      >
                        <Star
                          className="h-10 w-10 transition-colors"
                          style={{
                            color: v <= display ? GOLD : 'rgba(245,241,232,0.2)',
                            fill: v <= display ? GOLD : 'transparent',
                          }}
                        />
                      </button>
                    ))}
                  </div>
                  <p className="mt-5 text-xs opacity-40">Kliknite na zvjezdice da ocijenite</p>
                </motion.div>
              )}

              {phase === 'feedback' && (
                <motion.div key="feedback" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
                  <h2 className="font-display text-xl font-bold">Žao nam je 💛</h2>
                  <p className="mt-1 text-sm opacity-55">
                    Recite nam šta nije bilo u redu — vaš komentar ide direktno vlasniku, ne javno.
                  </p>
                  <textarea
                    autoFocus
                    placeholder="Šta možemo poboljšati?"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={3}
                    className="mt-4 w-full resize-none rounded-xl border border-white/15 bg-white/[0.05] px-4 py-3 text-sm text-[#f5f1e8] outline-none placeholder:text-white/30"
                  />
                  <input
                    placeholder="Telefon ili email (opcionalno)"
                    value={contact}
                    onChange={(e) => setContact(e.target.value)}
                    className="mt-2 w-full rounded-xl border border-white/15 bg-white/[0.05] px-4 py-3 text-sm text-[#f5f1e8] outline-none placeholder:text-white/30"
                  />
                  {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
                  <button
                    onClick={submitFeedback}
                    disabled={!message.trim() || sending}
                    className="btn-glossy mt-4 flex w-full items-center justify-center gap-2 rounded-full py-3 font-bold text-[#14110d] disabled:opacity-50"
                    style={{ backgroundColor: GOLD }}
                  >
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    Pošalji
                  </button>
                </motion.div>
              )}

              {phase === 'done' && (
                <motion.div key="done" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="py-4">
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 16, delay: 0.1 }}>
                    {rating >= 4 || !data.gateEnabled ? (
                      <Heart className="mx-auto h-12 w-12" style={{ color: GOLD, fill: GOLD }} />
                    ) : (
                      <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-400" />
                    )}
                  </motion.div>
                  <h2 className="mt-3 font-display text-xl font-bold">Hvala Vam!</h2>
                  <p className="mt-1 text-sm opacity-55">
                    {rating >= 4 || !data.gateEnabled
                      ? data.googleReviewUrl
                        ? 'Preusmjeravamo vas na Google recenziju...'
                        : 'Drago nam je da vam se svidjelo!'
                      : 'Vaš komentar je poslan — trudit ćemo se biti bolji.'}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        <p className="relative mt-6 text-center text-[10px] uppercase tracking-[0.2em] opacity-30">
          Special Day
        </p>
      </div>
    </main>
  );
}
