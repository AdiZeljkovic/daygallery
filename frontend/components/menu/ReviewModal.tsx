'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Star, Send, Loader2, CheckCircle2, Heart } from 'lucide-react';
import { api, ApiError } from '@/lib/api';

interface ReviewModalProps {
  slug: string;
  name: string;
  googleReviewUrl?: string | null;
  reviewGateEnabled?: boolean;
  primary: string;
  onClose: () => void;
}

/**
 * Recenzije sa filterom: ≥4★ → Google recenzija; <4★ → privatna žalba (sprema se).
 * Ako gate isključen — bilo koja ocjena vodi na Google.
 */
export function ReviewModal({
  slug,
  name,
  googleReviewUrl,
  reviewGateEnabled,
  primary,
  onClose,
}: ReviewModalProps) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [phase, setPhase] = useState<'rate' | 'feedback' | 'done'>('rate');
  const [message, setMessage] = useState('');
  const [contact, setContact] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = (value: number) => {
    setRating(value);
    // gate isključen ili visoka ocjena → Google; niska → privatna forma
    if (!reviewGateEnabled || value >= 4) {
      if (googleReviewUrl) {
        setTimeout(() => {
          window.location.href = googleReviewUrl;
        }, 500);
        setPhase('done');
      } else {
        setPhase('done');
      }
    } else {
      setPhase('feedback');
    }
  };

  const submitFeedback = async () => {
    setSending(true);
    setError(null);
    try {
      await api(`/api/public/venues/${slug}/feedback`, {
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
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-5 backdrop-blur-md"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.92, y: 16 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.92, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 340, damping: 28 }}
        className="relative w-full max-w-sm rounded-3xl border border-white/10 bg-[#14110d] p-6 text-center text-[#f5f1e8] shadow-lifted"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-white/40 transition-colors hover:bg-white/10 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>

        <AnimatePresence mode="wait">
          {phase === 'rate' && (
            <motion.div key="rate" exit={{ opacity: 0 }}>
              <h2 className="font-display text-2xl font-bold">Kako vam se svidjelo?</h2>
              <p className="mt-1 text-sm opacity-55">{name}</p>
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
                      className="h-9 w-9 transition-colors"
                      style={{
                        color: v <= display ? primary : 'rgba(245,241,232,0.2)',
                        fill: v <= display ? primary : 'transparent',
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
                style={{ backgroundColor: primary }}
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Pošalji
              </button>
            </motion.div>
          )}

          {phase === 'done' && (
            <motion.div key="done" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="py-4">
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 16, delay: 0.1 }}>
                {rating >= 4 || !reviewGateEnabled ? (
                  <Heart className="mx-auto h-12 w-12" style={{ color: primary, fill: primary }} />
                ) : (
                  <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-400" />
                )}
              </motion.div>
              <h2 className="mt-3 font-display text-xl font-bold">Hvala Vam!</h2>
              <p className="mt-1 text-sm opacity-55">
                {rating >= 4 || !reviewGateEnabled
                  ? googleReviewUrl
                    ? 'Preusmjeravamo vas na Google recenziju...'
                    : 'Drago nam je da vam se svidjelo!'
                  : 'Vaš komentar je poslan — trudit ćemo se biti bolji.'}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}
