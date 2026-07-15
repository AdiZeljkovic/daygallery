'use client';

import { use, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'motion/react';
import {
  Boxes,
  Plus,
  Minus,
  Trash2,
  Loader2,
  AlertTriangle,
  PackageX,
  X,
  Check,
} from 'lucide-react';
import { api, ApiError, authApi } from '@/lib/api';
import { type AdminMenuTree, imageUrl } from '@/lib/menuTypes';

interface InventoryRow {
  id: number;
  name: string;
  unit: string;
  quantity: string; // Decimal kao string
  lowStockAt: string | null;
}

interface MenuItemStock {
  id: number;
  name: string;
  imagePath: string | null;
  stockQty: number | null;
  lowStockAt: number | null;
  isAvailable: boolean;
}

export default function InventoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: venueId } = use(params);
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);

  const { data: user } = useQuery({ queryKey: ['me'], queryFn: authApi.me, retry: false });
  const isWorker = user?.staff?.role === 'waiter' || user?.staff?.role === 'kitchen';

  // Artikli menija sa stanjem
  const { data: menu, isLoading: menuLoading } = useQuery({
    queryKey: ['menu', venueId],
    queryFn: () => api<AdminMenuTree>(`/api/venues/${venueId}/menu`),
  });

  // Opći inventar
  const { data: supplies, isLoading: suppliesLoading } = useQuery({
    queryKey: ['inventory', venueId],
    queryFn: () => api<InventoryRow[]>(`/api/venues/${venueId}/inventory`),
  });

  const items: (MenuItemStock & { isDrink: boolean })[] =
    menu?.categories.flatMap((c) =>
      c.items.map((i) => ({
        id: i.id,
        name: i.name,
        imagePath: i.imagePath,
        stockQty: (i as unknown as MenuItemStock).stockQty ?? null,
        lowStockAt: (i as unknown as MenuItemStock).lowStockAt ?? null,
        isAvailable: i.isAvailable ?? true,
        isDrink: c.kind === 'drink',
      }))
    ) ?? [];

  // Pića: uvijek se prikazuju (šef samo unese stanje). Hrana: opcionalno praćenje.
  const drinkItems = [...items.filter((i) => i.isDrink)].sort((a, b) => a.name.localeCompare(b.name));
  const foodItems = items.filter((i) => !i.isDrink);
  const foodTracked = foodItems.filter((i) => i.stockQty !== null);
  const foodUntracked = foodItems.filter((i) => i.stockQty === null);
  const alerts = items.filter(
    (i) => i.stockQty !== null && (i.stockQty === 0 || (i.lowStockAt !== null && i.stockQty <= i.lowStockAt))
  );

  const patchItem = useMutation({
    mutationFn: ({ itemId, data }: { itemId: number; data: Record<string, unknown> }) =>
      api(`/api/items/${itemId}`, { method: 'PATCH', body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['menu', venueId] }),
  });

  const patchSupply = useMutation({
    mutationFn: ({ supplyId, data }: { supplyId: number; data: Record<string, unknown> }) =>
      api(`/api/inventory/${supplyId}`, { method: 'PATCH', body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inventory', venueId] }),
  });

  const deleteSupply = useMutation({
    mutationFn: (supplyId: number) => api(`/api/inventory/${supplyId}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inventory', venueId] }),
  });

  if (menuLoading || suppliesLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-gold-dark" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
      {/* Upozorenja */}
      <AnimatePresence>
        {alerts.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 space-y-2"
          >
            {alerts.map((item) => (
              <div
                key={item.id}
                className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium ${
                  item.stockQty === 0
                    ? 'border-red-200 bg-red-50 text-red-600'
                    : 'border-amber-50 bg-amber-50 text-amber-700'
                }`}
              >
                {item.stockQty === 0 ? (
                  <PackageX className="h-4 w-4 shrink-0" />
                ) : (
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                )}
                <span className="flex-1">
                  <strong>{item.name}</strong>
                  {item.stockQty === 0
                    ? ' — nema na stanju (automatski sklonjen sa menija)'
                    : ` — nisko stanje: ostalo ${item.stockQty}`}
                </span>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pića — uvijek sva, šef samo unese stanje */}
      {drinkItems.length > 0 && (
        <section>
          <div className="mb-4">
            <h2 className="font-display text-xl font-bold">Pića — stanje</h2>
            <p className="mt-0.5 text-sm text-ink/50">
              Sva pića iz menija. Upiši koliko je na stanju — potvrđena narudžba automatski odbija
              količinu. Na nuli se piće sklanja sa menija dok ne dopuniš.
            </p>
          </div>
          <div className="space-y-2">
            {drinkItems.map((item) => (
              <StockRow
                key={item.id}
                item={item}
                readOnly={isWorker}
                alwaysTrack
                onPatch={(data) => patchItem.mutate({ itemId: item.id, data })}
              />
            ))}
          </div>
        </section>
      )}

      {/* Hrana — opcionalno praćenje */}
      <section className={drinkItems.length > 0 ? 'mt-10' : ''}>
        <div className="mb-4">
          <h2 className="font-display text-xl font-bold">Hrana — stanje</h2>
          <p className="mt-0.5 text-sm text-ink/50">
            Za hranu praćenje je opcionalno — uključi ga samo za artikle koje želiš pratiti.
          </p>
        </div>

        <div className="space-y-2">
          {foodTracked.map((item) => (
            <StockRow
              key={item.id}
              item={item}
              readOnly={isWorker}
              onPatch={(data) => patchItem.mutate({ itemId: item.id, data })}
            />
          ))}
          {foodTracked.length === 0 && (
            <div className="rounded-xl border border-dashed border-ink/15 px-4 py-8 text-center text-sm text-ink/40">
              Nijedan artikal hrane ne prati stanje. Klikni "Prati stanje" na artiklu ispod.
            </div>
          )}
        </div>

        {!isWorker && foodUntracked.length > 0 && (
          <details className="mt-4">
            <summary className="cursor-pointer text-sm font-medium text-ink/50 hover:text-ink">
              Hrana bez praćenja stanja ({foodUntracked.length}) — klikni za prikaz
            </summary>
            <div className="mt-3 space-y-2">
              {foodUntracked.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 rounded-xl border border-ink/8 bg-white p-3"
                >
                  <ItemThumb item={item} />
                  <span className="flex-1 text-sm font-medium">{item.name}</span>
                  <button
                    onClick={() => patchItem.mutate({ itemId: item.id, data: { stockQty: 0 } })}
                    className="rounded-full bg-gold/12 px-3.5 py-1.5 text-xs font-semibold text-gold-dark transition-colors hover:bg-gold/25"
                  >
                    + Prati stanje
                  </button>
                </div>
              ))}
            </div>
          </details>
        )}
      </section>

      {/* Opći inventar */}
      <section className="mt-10">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="font-display text-xl font-bold">Opći inventar</h2>
            <p className="mt-0.5 text-sm text-ink/50">
              Potrošni materijal — mlijeko, čaše, salvete... (ručno se vodi)
            </p>
          </div>
          {!isWorker && (
            <button
              onClick={() => setAddOpen(true)}
              className="btn-glossy flex items-center gap-2 rounded-full bg-gold px-4 py-2 text-sm font-semibold text-neutral-900"
            >
              <Plus className="h-4 w-4" />
              Dodaj stavku
            </button>
          )}
        </div>

        <div className="space-y-2">
          {supplies?.map((supply) => (
            <SupplyRow
              key={supply.id}
              supply={supply}
              readOnly={isWorker}
              onPatch={(data) => patchSupply.mutate({ supplyId: supply.id, data })}
              onDelete={() => {
                if (confirm(`Obrisati "${supply.name}"?`)) deleteSupply.mutate(supply.id);
              }}
            />
          ))}
          {!supplies?.length && (
            <div className="rounded-xl border border-dashed border-ink/15 px-4 py-8 text-center text-sm text-ink/40">
              <Boxes className="mx-auto mb-2 h-6 w-6 text-ink/20" />
              Nema stavki. Dodaj npr. "Mlijeko", "Čaše 0.3", "Salvete"...
            </div>
          )}
        </div>
      </section>

      {addOpen && (
        <AddSupplyModal
          venueId={venueId}
          onClose={() => setAddOpen(false)}
          onSaved={() => {
            setAddOpen(false);
            qc.invalidateQueries({ queryKey: ['inventory', venueId] });
          }}
        />
      )}
    </div>
  );
}

function ItemThumb({ item }: { item: { name: string; imagePath: string | null } }) {
  return item.imagePath ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={imageUrl(item.imagePath)!} alt="" className="h-10 w-10 rounded-lg object-cover" />
  ) : (
    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-ink/5 font-display text-sm font-bold text-ink/30">
      {item.name[0]}
    </div>
  );
}

function StockRow({
  item,
  readOnly,
  onPatch,
  alwaysTrack = false,
}: {
  item: MenuItemStock;
  readOnly: boolean;
  onPatch: (data: Record<string, unknown>) => void;
  alwaysTrack?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [qty, setQty] = useState(String(item.stockQty ?? 0));
  const [threshold, setThreshold] = useState(item.lowStockAt?.toString() ?? '');

  const zero = item.stockQty === 0;
  const low = !zero && item.lowStockAt !== null && (item.stockQty ?? 0) <= item.lowStockAt;

  return (
    <motion.div
      layout
      className={`flex flex-wrap items-center gap-3 rounded-xl border bg-white p-3 ${
        zero ? 'border-red-200' : low ? 'border-amber-50' : 'border-ink/8'
      }`}
    >
      <ItemThumb item={item} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{item.name}</p>
        {item.stockQty === null ? (
          <p className="text-xs font-medium text-gold-dark">Upiši stanje →</p>
        ) : zero ? (
          <p className="text-xs font-semibold text-red-500">Nema na stanju</p>
        ) : low ? (
          <p className="text-xs font-semibold text-amber-600">Nisko stanje</p>
        ) : (
          <p className="text-xs text-ink/40">
            Prag upozorenja: {item.lowStockAt ?? '—'}
          </p>
        )}
      </div>

      {readOnly ? (
        <span className="font-display text-xl font-bold">{item.stockQty ?? '—'}</span>
      ) : editing ? (
        <div className="flex items-center gap-2">
          <input
            autoFocus
            inputMode="numeric"
            value={qty}
            onChange={(e) => setQty(e.target.value.replace(/\D/g, ''))}
            className="w-20 rounded-lg border border-gold px-2 py-1.5 text-center text-sm font-bold outline-none"
            placeholder="Stanje"
          />
          <input
            inputMode="numeric"
            value={threshold}
            onChange={(e) => setThreshold(e.target.value.replace(/\D/g, ''))}
            className="w-20 rounded-lg border border-ink/12 px-2 py-1.5 text-center text-sm outline-none focus:border-gold"
            placeholder="Prag"
            title="Prag za upozorenje o niskom stanju"
          />
          <button
            onClick={() => {
              onPatch({
                stockQty: parseInt(qty) || 0,
                lowStockAt: threshold ? parseInt(threshold) : null,
                ...(parseInt(qty) > 0 && !item.isAvailable ? { isAvailable: true } : {}),
              });
              setEditing(false);
            }}
            className="rounded-lg bg-emerald-500 p-2 text-[#fff]"
          >
            <Check className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onPatch({ stockQty: Math.max(0, (item.stockQty ?? 0) - 1) })}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-ink/5 text-ink/60 transition-colors hover:bg-ink/10"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => {
              setQty(String(item.stockQty ?? 0));
              setThreshold(item.lowStockAt?.toString() ?? '');
              setEditing(true);
            }}
            className={`w-16 rounded-lg py-1 text-center font-display text-xl font-bold transition-colors hover:bg-ink/5 ${
              zero ? 'text-red-500' : low ? 'text-amber-600' : ''
            }`}
            title="Klikni za unos tačnog broja i praga"
          >
            {item.stockQty ?? '—'}
          </button>
          <button
            onClick={() =>
              onPatch({
                stockQty: (item.stockQty ?? 0) + 1,
                ...((item.stockQty ?? 0) === 0 && !item.isAvailable ? { isAvailable: true } : {}),
              })
            }
            className="flex h-8 w-8 items-center justify-center rounded-full bg-gold/15 text-gold-dark transition-colors hover:bg-gold/30"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
          {!alwaysTrack && (
            <button
              onClick={() => onPatch({ stockQty: null, lowStockAt: null })}
              className="ml-1 rounded-lg p-1.5 text-ink/30 transition-colors hover:bg-ink/5 hover:text-ink/60"
              title="Prestani pratiti stanje"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}
    </motion.div>
  );
}

function SupplyRow({
  supply,
  readOnly,
  onPatch,
  onDelete,
}: {
  supply: InventoryRow;
  readOnly: boolean;
  onPatch: (data: Record<string, unknown>) => void;
  onDelete: () => void;
}) {
  const qty = parseFloat(supply.quantity);
  const low = supply.lowStockAt !== null && qty <= parseFloat(supply.lowStockAt);

  return (
    <div
      className={`flex items-center gap-3 rounded-xl border bg-white p-3 ${
        low ? 'border-amber-50' : 'border-ink/8'
      }`}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold/10">
        <Boxes className="h-4 w-4 text-gold-dark" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{supply.name}</p>
        {low && <p className="text-xs font-semibold text-amber-600">Nisko stanje</p>}
      </div>

      {readOnly ? (
        <span className="font-display text-lg font-bold">
          {qty} <span className="text-xs font-normal text-ink/40">{supply.unit}</span>
        </span>
      ) : (
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onPatch({ quantity: Math.max(0, qty - 1) })}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-ink/5 text-ink/60 hover:bg-ink/10"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <span className={`w-20 text-center font-display text-lg font-bold ${low ? 'text-amber-600' : ''}`}>
            {qty} <span className="text-xs font-normal text-ink/40">{supply.unit}</span>
          </span>
          <button
            onClick={() => onPatch({ quantity: qty + 1 })}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-gold/15 text-gold-dark hover:bg-gold/30"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onDelete}
            className="ml-1 rounded-lg p-1.5 text-ink/30 hover:bg-red-50 hover:text-red-500"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

function AddSupplyModal({
  venueId,
  onClose,
  onSaved,
}: {
  venueId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('kom');
  const [quantity, setQuantity] = useState('');
  const [lowStockAt, setLowStockAt] = useState('');
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () =>
      api(`/api/venues/${venueId}/inventory`, {
        method: 'POST',
        body: JSON.stringify({
          name,
          unit,
          quantity: parseFloat(quantity) || 0,
          lowStockAt: lowStockAt ? parseFloat(lowStockAt) : null,
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
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-lifted"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-lg font-bold">Nova stavka inventara</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-ink/40 hover:bg-ink/5 hover:text-ink">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-3">
          <input autoFocus placeholder="Naziv (npr. Mlijeko)" value={name} onChange={(e) => setName(e.target.value)} className={input} />
          <div className="flex gap-2">
            <input placeholder="Količina" inputMode="decimal" value={quantity} onChange={(e) => setQuantity(e.target.value.replace(',', '.'))} className={input} />
            <select value={unit} onChange={(e) => setUnit(e.target.value)} className={`${input} w-24 shrink-0 bg-white`}>
              {['kom', 'kg', 'g', 'l', 'ml', 'pak'].map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </div>
          <input placeholder="Prag upozorenja (opcionalno)" inputMode="decimal" value={lowStockAt} onChange={(e) => setLowStockAt(e.target.value.replace(',', '.'))} className={input} />
        </div>
        {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
        <button
          onClick={() => save.mutate()}
          disabled={!name.trim() || save.isPending}
          className="btn-glossy mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-gold py-2.5 text-sm font-semibold text-neutral-900 disabled:opacity-50"
        >
          {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Dodaj
        </button>
      </motion.div>
    </motion.div>
  );
}
