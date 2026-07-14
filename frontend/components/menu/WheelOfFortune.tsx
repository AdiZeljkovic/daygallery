'use client';

import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Gift, Sparkles, PartyPopper } from 'lucide-react';
import type { MenuItemRow } from '@/lib/menuTypes';
import { imageUrl, finalPrice, fmtPrice } from '@/lib/menuTypes';

interface WheelProps {
  prizes: MenuItemRow[]; // istaknuti artikli = nagrade
  percentage: number;
  currency: string;
  primary: string;
  onClose: () => void;
  onWin: (item: MenuItemRow) => void;
}

const SLICE_TONES = ['#1a1712', '#2a2118'];

/**
 * Kolo sreće — gost zavrti, uvijek osvoji popust na nasumičan istaknut artikal.
 * Točak je "namješten" da stane na osvojeni artikal (kao stari day-gallery).
 */
export function WheelOfFortune({ prizes, percentage, currency, primary, onClose, onWin }: WheelProps) {
  const slices = useMemo(() => prizes.slice(0, 8), [prizes]);
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [won, setWon] = useState<MenuItemRow | null>(null);

  if (slices.length === 0) return null;

  const sliceAngle = 360 / slices.length;

  const spin = () => {
    if (spinning || won) return;
    setSpinning(true);
    const winIndex = Math.floor(Math.random() * slices.length);
    // pokazivač je na vrhu (12h); okreni tako da centar pobjedničke kriške dođe na vrh
    const target = 360 * 6 - (winIndex * sliceAngle + sliceAngle / 2);
    setRotation(target);
    setTimeout(() => {
      const winner = slices[winIndex];
      setWon(winner);
      setSpinning(false);
      onWin(winner);
    }, 4200);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-5 backdrop-blur-md"
      onClick={won ? onClose : undefined}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0 }}
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
          {!won ? (
            <motion.div key="wheel" exit={{ opacity: 0, scale: 0.95 }}>
              <div className="mb-1 flex items-center justify-center gap-2">
                <Gift className="h-5 w-5" style={{ color: primary }} />
                <h2 className="font-display text-2xl font-bold">Kolo sreće</h2>
              </div>
              <p className="mb-5 text-sm opacity-55">
                Zavrti i osvoji <strong style={{ color: primary }}>-{percentage}%</strong> na artikal!
              </p>

              {/* Točak */}
              <div className="relative mx-auto mb-6 aspect-square w-64">
                {/* pokazivač */}
                <div
                  className="absolute left-1/2 top-[-6px] z-20 h-0 w-0 -translate-x-1/2"
                  style={{
                    borderLeft: '11px solid transparent',
                    borderRight: '11px solid transparent',
                    borderTop: `18px solid ${primary}`,
                  }}
                />
                <motion.div
                  animate={{ rotate: rotation }}
                  transition={{ duration: 4.2, ease: [0.16, 1, 0.3, 1] }}
                  className="relative h-full w-full rounded-full border-4 shadow-lifted"
                  style={{ borderColor: primary }}
                >
                  <svg viewBox="0 0 100 100" className="h-full w-full">
                    {slices.map((item, i) => {
                      const start = (i * sliceAngle - 90) * (Math.PI / 180);
                      const end = ((i + 1) * sliceAngle - 90) * (Math.PI / 180);
                      const x1 = 50 + 50 * Math.cos(start);
                      const y1 = 50 + 50 * Math.sin(start);
                      const x2 = 50 + 50 * Math.cos(end);
                      const y2 = 50 + 50 * Math.sin(end);
                      const mid = (i * sliceAngle + sliceAngle / 2 - 90) * (Math.PI / 180);
                      const tx = 50 + 32 * Math.cos(mid);
                      const ty = 50 + 32 * Math.sin(mid);
                      return (
                        <g key={item.id}>
                          <path
                            d={`M50 50 L ${x1} ${y1} A 50 50 0 0 1 ${x2} ${y2} Z`}
                            fill={SLICE_TONES[i % 2]}
                            stroke={`${primary}55`}
                            strokeWidth="0.4"
                          />
                          <text
                            x={tx}
                            y={ty}
                            fill={primary}
                            fontSize="5"
                            fontWeight="bold"
                            textAnchor="middle"
                            dominantBaseline="middle"
                            transform={`rotate(${i * sliceAngle + sliceAngle / 2}, ${tx}, ${ty})`}
                          >
                            -{percentage}%
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                  {/* centar */}
                  <div
                    className="absolute left-1/2 top-1/2 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-[#14110d]"
                    style={{ backgroundColor: primary }}
                  >
                    <Sparkles className="h-5 w-5 text-[#14110d]" />
                  </div>
                </motion.div>
              </div>

              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={spin}
                disabled={spinning}
                className="btn-glossy w-full rounded-full py-3.5 font-bold text-[#14110d] disabled:opacity-60"
                style={{ backgroundColor: primary }}
              >
                {spinning ? 'Vrti se...' : 'ZAVRTI'}
              </motion.button>
            </motion.div>
          ) : (
            <motion.div
              key="won"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="py-2"
            >
              <motion.div
                initial={{ scale: 0, rotate: -20 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 16, delay: 0.1 }}
              >
                <PartyPopper className="mx-auto h-12 w-12" style={{ color: primary }} />
              </motion.div>
              <h2 className="mt-3 font-display text-2xl font-bold">Čestitamo! 🎉</h2>
              <p className="mt-1 text-sm opacity-55">Osvojili ste popust na:</p>

              <div className="mx-auto mt-4 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.05] p-3 text-left">
                {won.imagePath && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={imageUrl(won.imagePath)!} alt="" className="h-14 w-14 rounded-xl object-cover" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{won.name}</p>
                  <div className="flex items-center gap-2">
                    <span className="text-xs line-through opacity-40">
                      {fmtPrice(parseFloat(won.price), currency)}
                    </span>
                    <span className="font-display text-lg font-bold" style={{ color: primary }}>
                      {fmtPrice(finalPrice(won.price, percentage), currency)}
                    </span>
                    <span
                      className="rounded-full px-1.5 py-0.5 text-[10px] font-bold text-[#14110d]"
                      style={{ backgroundColor: primary }}
                    >
                      -{percentage}%
                    </span>
                  </div>
                </div>
              </div>

              <p className="mt-3 text-xs opacity-45">
                Popust je primijenjen — dodaj artikal u narudžbu da ga iskoristiš.
              </p>
              <button
                onClick={onClose}
                className="btn-glossy mt-5 w-full rounded-full py-3 font-bold text-[#14110d]"
                style={{ backgroundColor: primary }}
              >
                Super!
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}
