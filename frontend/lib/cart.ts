import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface CartLine {
  itemId: number;
  name: string;
  unitPrice: number; // finalna cijena (s popustom) — samo za prikaz; server računa svoj total
  quantity: number;
  imagePath?: string | null;
}

interface CartState {
  venueSlug: string | null;
  lines: CartLine[];
  add: (venueSlug: string, line: Omit<CartLine, 'quantity'>) => void;
  increment: (itemId: number) => void;
  decrement: (itemId: number) => void;
  remove: (itemId: number) => void;
  clear: () => void;
  total: () => number;
  count: () => number;
}

/**
 * Korpa perzistira u localStorage. Vezana je za jedan venue —
 * ulazak u meni drugog objekta prazni korpu (add s drugim slugom).
 */
export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      venueSlug: null,
      lines: [],

      add: (venueSlug, line) =>
        set((s) => {
          const lines = s.venueSlug === venueSlug ? s.lines : [];
          const existing = lines.find((l) => l.itemId === line.itemId);
          return {
            venueSlug,
            lines: existing
              ? lines.map((l) =>
                  l.itemId === line.itemId ? { ...l, quantity: l.quantity + 1 } : l
                )
              : [...lines, { ...line, quantity: 1 }],
          };
        }),

      increment: (itemId) =>
        set((s) => ({
          lines: s.lines.map((l) =>
            l.itemId === itemId ? { ...l, quantity: Math.min(l.quantity + 1, 50) } : l
          ),
        })),

      decrement: (itemId) =>
        set((s) => ({
          lines: s.lines
            .map((l) => (l.itemId === itemId ? { ...l, quantity: l.quantity - 1 } : l))
            .filter((l) => l.quantity > 0),
        })),

      remove: (itemId) => set((s) => ({ lines: s.lines.filter((l) => l.itemId !== itemId) })),
      clear: () => set({ lines: [] }),

      total: () => get().lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0),
      count: () => get().lines.reduce((sum, l) => sum + l.quantity, 0),
    }),
    { name: 'sd_cart', storage: createJSONStorage(() => localStorage) }
  )
);
