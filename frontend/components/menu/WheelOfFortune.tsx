'use client';

import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Gift, PartyPopper } from 'lucide-react';
import type { MenuItemRow } from '@/lib/menuTypes';
import { imageUrl, finalPrice, fmtPrice } from '@/lib/menuTypes';

interface WheelProps {
  prizes: MenuItemRow[]; // istaknuti artikli = moguće nagrade
  fillerNames?: string[]; // ostala imena jela (dekoracija segmenata)
  percentage: number;
  currency: string;
  primary: string;
  onClose: () => void;
  onWin: (item: MenuItemRow) => void;
}

const SLICES = 6;
const FALLBACK = ['Desert Gratis', 'Kafa Gratis', 'Specijalni Popust', 'Piće Gratis', 'Vino Gratis'];

// zatamni hex boju (f<1) → rgb string
function shade(hex: string, f: number): string {
  const h = hex.replace('#', '');
  const n = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const r = Math.round(parseInt(n.slice(0, 2), 16) * f);
  const g = Math.round(parseInt(n.slice(2, 4), 16) * f);
  const b = Math.round(parseInt(n.slice(4, 6), 16) * f);
  return `rgb(${r}, ${g}, ${b})`;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Kolo sreće — gost zavrti, uvijek osvoji popust na nasumičan istaknut artikal.
 * Puno zlatno kolo sa imenima jela (kao stari day-gallery); kolo je "namješteno"
 * da stane na pobjednički segment (index 0, ispod pokazivača).
 */
export function WheelOfFortune({
  prizes,
  fillerNames = [],
  percentage,
  currency,
  primary,
  onClose,
  onWin,
}: WheelProps) {
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [won, setWon] = useState<MenuItemRow | null>(null);

  // pobjednik i raspored segmenata biramo jednom (stabilno kroz render)
  const { winner, labels } = useMemo(() => {
    const win = prizes[Math.floor(Math.random() * prizes.length)];
    const others = shuffle(
      fillerNames.filter((n) => n && n !== win?.name)
    );
    const fillers: string[] = [];
    for (let i = 0; i < SLICES - 1; i++) {
      fillers.push(others[i] || FALLBACK[i % FALLBACK.length]);
    }
    return { winner: win, labels: [win?.name ?? '', ...fillers] };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!winner) return null;

  const tones = [primary, shade(primary, 0.72)];
  const sliceAngle = 360 / SLICES;

  const spin = () => {
    if (spinning || won) return;
    setSpinning(true);
    // pobjednik je segment 0 (centriran na vrhu); vrti 6 punih krugova i vrati na 0
    setRotation(360 * 6);
    setTimeout(() => {
      setWon(winner);
      setSpinning(false);
      onWin(winner);
    }, 4600);
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
        className="relative w-full max-w-md rounded-3xl border border-white/10 bg-[#14110d] p-6 text-center text-[#f5f1e8] shadow-lifted"
        onClick={(e) => e.stopPropagation()}
      >
        {!spinning && (
          <button
            onClick={onClose}
            className="absolute right-4 top-4 z-30 rounded-lg p-1.5 text-white/40 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        )}

        <AnimatePresence mode="wait">
          {!won ? (
            <motion.div key="wheel" exit={{ opacity: 0, scale: 0.95 }}>
              <div className="mb-1 flex items-center justify-center gap-2">
                <Gift className="h-5 w-5" style={{ color: primary }} />
                <h2 className="font-display text-2xl font-bold">Kolo sreće</h2>
              </div>
              <p className="mb-6 text-sm opacity-55">
                Osvoji <strong style={{ color: primary }}>-{percentage}%</strong> na naše izdvojeno
                jelo — zavrti!
              </p>

              {/* Točak */}
              <div className="relative mx-auto mb-7 aspect-square w-72 sm:w-80">
                {/* pokazivač */}
                <div
                  className="absolute left-1/2 top-[-8px] z-20 h-0 w-0 -translate-x-1/2 drop-shadow"
                  style={{
                    borderLeft: '12px solid transparent',
                    borderRight: '12px solid transparent',
                    borderTop: `20px solid ${primary}`,
                  }}
                />
                <motion.div
                  animate={{ rotate: rotation }}
                  transition={{ duration: 4.6, ease: [0.16, 1, 0.3, 1] }}
                  className="relative h-full w-full overflow-hidden rounded-full border-4 shadow-lifted"
                  style={{
                    borderColor: primary,
                    // segment 0 centriran na vrhu: počni gradijent na -30deg
                    background: `conic-gradient(from -${sliceAngle / 2}deg, ${Array.from(
                      { length: SLICES },
                      (_, i) =>
                        `${tones[i % 2]} ${i * sliceAngle}deg ${(i + 1) * sliceAngle}deg`
                    ).join(', ')})`,
                  }}
                >
                  {/* linije između segmenata */}
                  {Array.from({ length: SLICES }).map((_, i) => (
                    <div
                      key={`ln-${i}`}
                      className="absolute left-1/2 top-1/2 h-[1.5px] w-1/2 origin-left"
                      style={{
                        background: 'rgba(20,17,13,0.25)',
                        transform: `translateY(-50%) rotate(${i * sliceAngle - sliceAngle / 2 - 90}deg)`,
                      }}
                    />
                  ))}

                  {/* natpisi (imena jela) */}
                  {labels.map((label, i) => (
                    <div
                      key={`lb-${i}`}
                      className="absolute left-1/2 top-1/2 flex h-7 origin-left items-center justify-end pr-3"
                      style={{
                        width: '50%',
                        transform: `translateY(-50%) rotate(${i * sliceAngle - 90}deg)`,
                      }}
                    >
                      <span
                        className="line-clamp-2 w-full text-right text-[11px] font-bold leading-tight"
                        style={{ color: '#1a1410' }}
                      >
                        {label}
                      </span>
                    </div>
                  ))}

                  {/* centar */}
                  <div
                    className="absolute left-1/2 top-1/2 z-10 h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-[#14110d]"
                    style={{ backgroundColor: primary }}
                  />
                </motion.div>
              </div>

              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={spin}
                disabled={spinning}
                className="btn-glossy w-full rounded-full py-3.5 font-bold text-[#14110d] disabled:opacity-70"
                style={{ backgroundColor: primary }}
              >
                {spinning ? 'Sreća se okreće…' : 'ZAVRTI TOČAK'}
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
                  <img
                    src={imageUrl(won.imagePath)!}
                    alt=""
                    className="h-14 w-14 rounded-xl object-cover"
                  />
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
