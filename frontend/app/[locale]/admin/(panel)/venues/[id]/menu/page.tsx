'use client';

import { use, useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plus,
  Pencil,
  Trash2,
  Star,
  ImagePlus,
  ChevronDown,
  Coffee,
  UtensilsCrossed,
  Megaphone,
  X,
  Loader2,
  EyeOff,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import {
  type AdminMenuTree,
  type MenuCategoryRow,
  type MenuItemRow,
  imageUrl,
  finalPrice,
  fmtPrice,
} from '@/lib/menuTypes';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

const KIND_META = {
  food: { label: 'Hrana', icon: UtensilsCrossed },
  drink: { label: 'Pića', icon: Coffee },
  promo: { label: 'Promo', icon: Megaphone },
} as const;

export default function MenuEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: venueId } = use(params);
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['menu', venueId] });

  const { data: menu, isLoading } = useQuery({
    queryKey: ['menu', venueId],
    queryFn: () => api<AdminMenuTree>(`/api/venues/${venueId}/menu`),
  });

  const { data: venue } = useQuery({
    queryKey: ['venue', venueId],
    queryFn: () => api<{ currency: string }>(`/api/venues/${venueId}`),
  });
  const currency = venue?.currency ?? 'BAM';

  const [openCategories, setOpenCategories] = useState<Set<number>>(new Set());
  const [categoryModal, setCategoryModal] = useState<{ category?: MenuCategoryRow } | null>(null);
  const [itemModal, setItemModal] = useState<{ categoryId: number; item?: MenuItemRow } | null>(null);

  const toggleCategory = (id: number) =>
    setOpenCategories((s) => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const deleteCategory = useMutation({
    mutationFn: (id: number) => api(`/api/categories/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  });

  const deleteItem = useMutation({
    mutationFn: (id: number) => api(`/api/items/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  });

  const patchItem = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) =>
      api(`/api/items/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    onSuccess: invalidate,
  });

  if (isLoading || !menu) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-gold-dark" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-5 flex items-center justify-between">
        <p className="text-sm text-ink/50">
          {menu.categories.length} kategorija ·{' '}
          {menu.categories.reduce((n, c) => n + c.items.length, 0)} artikala
        </p>
        <button
          onClick={() => setCategoryModal({})}
          className="btn-glossy flex items-center gap-2 rounded-full bg-gold px-4 py-2 text-sm font-semibold text-neutral-900 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Nova kategorija
        </button>
      </div>

      <div className="space-y-3">
        <AnimatePresence initial={false}>
          {menu.categories.map((category) => {
            const Icon = KIND_META[category.kind].icon;
            const open = openCategories.has(category.id);
            return (
              <motion.div
                key={category.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97 }}
                className="overflow-hidden rounded-xl border border-ink/8 bg-white shadow-soft"
              >
                <div
                  className="flex cursor-pointer items-center gap-3 px-4 py-3.5 transition-colors hover:bg-ink/[0.02]"
                  onClick={() => toggleCategory(category.id)}
                >
                  <span className="rounded-lg bg-gold/10 p-2">
                    <Icon className="h-4 w-4 text-gold-dark" />
                  </span>
                  <div className="flex-1">
                    <h3 className="font-semibold">{category.name}</h3>
                    <p className="text-xs text-ink/40">
                      {KIND_META[category.kind].label} · {category.items.length} artikala
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setItemModal({ categoryId: category.id });
                    }}
                    className="rounded-lg p-2 text-ink/40 transition-colors hover:bg-gold/10 hover:text-gold-dark"
                    title="Dodaj artikal"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setCategoryModal({ category });
                    }}
                    className="rounded-lg p-2 text-ink/40 transition-colors hover:bg-ink/5 hover:text-ink"
                    title="Uredi kategoriju"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`Obrisati kategoriju "${category.name}" i sve njene artikle?`))
                        deleteCategory.mutate(category.id);
                    }}
                    className="rounded-lg p-2 text-ink/40 transition-colors hover:bg-red-50 hover:text-red-500"
                    title="Obriši"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                  <ChevronDown
                    className={`h-4 w-4 text-ink/30 transition-transform ${open ? 'rotate-180' : ''}`}
                  />
                </div>

                <AnimatePresence initial={false}>
                  {open && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: 'easeInOut' }}
                    >
                      <div className="divide-y divide-ink/5 border-t border-ink/8">
                        {category.items.length === 0 && (
                          <p className="px-4 py-4 text-sm text-ink/35">Nema artikala.</p>
                        )}
                        {category.items.map((item) => (
                          <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                            {item.imagePath ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={imageUrl(item.imagePath)!}
                                alt=""
                                className="h-11 w-11 rounded-lg object-cover"
                              />
                            ) : (
                              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-ink/4 text-ink/25">
                                <ImagePlus className="h-4 w-4" />
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <p className={`truncate text-sm font-medium ${item.isAvailable === false ? 'text-ink/35 line-through' : ''}`}>
                                  {item.name}
                                </p>
                                {item.isFeatured && (
                                  <Star className="h-3.5 w-3.5 shrink-0 fill-gold text-gold" />
                                )}
                                {item.isAvailable === false && (
                                  <EyeOff className="h-3.5 w-3.5 shrink-0 text-ink/30" />
                                )}
                              </div>
                              {item.description && (
                                <p className="truncate text-xs text-ink/40">{item.description}</p>
                              )}
                            </div>
                            <div className="text-right">
                              {item.discountPercent ? (
                                <>
                                  <p className="text-xs text-ink/35 line-through">
                                    {fmtPrice(parseFloat(item.price), currency)}
                                  </p>
                                  <p className="text-sm font-semibold text-gold-dark">
                                    {fmtPrice(finalPrice(item.price, item.discountPercent), currency)}
                                  </p>
                                </>
                              ) : (
                                <p className="text-sm font-semibold">
                                  {fmtPrice(parseFloat(item.price), currency)}
                                </p>
                              )}
                            </div>
                            <button
                              onClick={() =>
                                patchItem.mutate({
                                  id: item.id,
                                  data: { isAvailable: !(item.isAvailable ?? true) },
                                })
                              }
                              className={`rounded-lg px-2 py-1 text-[11px] font-medium transition-colors ${
                                item.isAvailable === false
                                  ? 'bg-ink/5 text-ink/40 hover:bg-emerald-50 hover:text-emerald-600'
                                  : 'bg-emerald-50 text-emerald-600 hover:bg-ink/5 hover:text-ink/40'
                              }`}
                            >
                              {item.isAvailable === false ? 'Skriven' : 'Dostupan'}
                            </button>
                            <button
                              onClick={() => setItemModal({ categoryId: category.id, item })}
                              className="rounded-lg p-1.5 text-ink/40 transition-colors hover:bg-ink/5 hover:text-ink"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => {
                                if (confirm(`Obrisati "${item.name}"?`)) deleteItem.mutate(item.id);
                              }}
                              className="rounded-lg p-1.5 text-ink/40 transition-colors hover:bg-red-50 hover:text-red-500"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {menu.categories.length === 0 && (
          <div className="rounded-xl border border-dashed border-ink/15 py-16 text-center">
            <p className="text-ink/40">Meni je prazan — dodaj prvu kategoriju.</p>
          </div>
        )}
      </div>

      {categoryModal && (
        <CategoryModal
          menuId={menu.id}
          category={categoryModal.category}
          onClose={() => setCategoryModal(null)}
          onSaved={() => {
            setCategoryModal(null);
            invalidate();
          }}
        />
      )}
      {itemModal && (
        <ItemModal
          categoryId={itemModal.categoryId}
          item={itemModal.item}
          currency={currency}
          onClose={() => setItemModal(null)}
          onSaved={() => {
            setItemModal(null);
            invalidate();
          }}
        />
      )}
    </div>
  );
}

// ================================================================
// Modal: kategorija
// ================================================================

function CategoryModal({
  menuId,
  category,
  onClose,
  onSaved,
}: {
  menuId: number;
  category?: MenuCategoryRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(category?.name ?? '');
  const [kind, setKind] = useState<'food' | 'drink' | 'promo'>(category?.kind ?? 'food');
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () =>
      category
        ? api(`/api/categories/${category.id}`, {
            method: 'PATCH',
            body: JSON.stringify({ name, kind }),
          })
        : api(`/api/menus/${menuId}/categories`, {
            method: 'POST',
            body: JSON.stringify({ name, kind }),
          }),
    onSuccess: onSaved,
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Greška'),
  });

  return (
    <ModalShell title={category ? 'Uredi kategoriju' : 'Nova kategorija'} onClose={onClose}>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-ink/50">Naziv</span>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-lg border border-ink/12 px-3 py-2 text-sm outline-none transition-colors focus:border-gold"
        />
      </label>

      <div className="mt-4">
        <span className="mb-1.5 block text-xs font-medium text-ink/50">Vrsta</span>
        <div className="grid grid-cols-3 gap-2">
          {(Object.keys(KIND_META) as (keyof typeof KIND_META)[]).map((k) => {
            const Icon = KIND_META[k].icon;
            return (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className={`flex items-center justify-center gap-1.5 rounded-lg border py-2 text-xs font-medium transition-colors ${
                  kind === k
                    ? 'border-gold bg-gold/10 text-gold-dark'
                    : 'border-ink/10 text-ink/50 hover:border-ink/25'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {KIND_META[k].label}
              </button>
            );
          })}
        </div>
      </div>

      {error && <p className="mt-3 text-sm text-red-500">{error}</p>}

      <button
        onClick={() => save.mutate()}
        disabled={!name.trim() || save.isPending}
        className="btn-glossy mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-gold py-2.5 text-sm font-semibold text-neutral-900 transition-colors disabled:opacity-50"
      >
        {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
        Sačuvaj
      </button>
    </ModalShell>
  );
}

// ================================================================
// Modal: artikal
// ================================================================

function ItemModal({
  categoryId,
  item,
  currency,
  onClose,
  onSaved,
}: {
  categoryId: number;
  item?: MenuItemRow;
  currency: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(item?.name ?? '');
  const [description, setDescription] = useState(item?.description ?? '');
  const [price, setPrice] = useState(item?.price ?? '');
  const [discount, setDiscount] = useState<string>(item?.discountPercent?.toString() ?? '');
  const [isFeatured, setIsFeatured] = useState(item?.isFeatured ?? false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [imagePath, setImagePath] = useState(item?.imagePath ?? null);

  const save = useMutation({
    mutationFn: async () => {
      const body = JSON.stringify({
        name,
        description,
        price: parseFloat(price) || 0,
        discountPercent: discount ? parseInt(discount) : null,
        isFeatured,
      });
      return item
        ? api<MenuItemRow>(`/api/items/${item.id}`, { method: 'PATCH', body })
        : api<MenuItemRow>(`/api/categories/${categoryId}/items`, { method: 'POST', body });
    },
    onSuccess: onSaved,
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Greška'),
  });

  const uploadImage = async (file: File) => {
    if (!item) return; // slika se dodaje nakon prvog spremanja
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('image', file);
      const res = await fetch(`${API_URL}/api/items/${item.id}/image`, {
        method: 'POST',
        credentials: 'include',
        body: form,
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Upload nije uspio');
      const updated = await res.json();
      setImagePath(updated.imagePath);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload nije uspio');
    } finally {
      setUploading(false);
    }
  };

  return (
    <ModalShell title={item ? 'Uredi artikal' : 'Novi artikal'} onClose={onClose}>
      <div className="flex gap-4">
        <button
          type="button"
          onClick={() => item && fileRef.current?.click()}
          disabled={!item || uploading}
          className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-dashed border-ink/20 text-ink/30 transition-colors hover:border-gold hover:text-gold-dark disabled:cursor-not-allowed"
          title={item ? 'Promijeni sliku' : 'Sliku možeš dodati nakon spremanja'}
        >
          {imagePath ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl(imagePath)!} alt="" className="h-full w-full object-cover" />
          ) : uploading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <ImagePlus className="h-5 w-5" />
          )}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0])}
        />

        <div className="flex-1 space-y-3">
          <input
            autoFocus
            placeholder="Naziv artikla"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-ink/12 px-3 py-2 text-sm outline-none transition-colors focus:border-gold"
          />
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                placeholder="Cijena"
                inputMode="decimal"
                value={price}
                onChange={(e) => setPrice(e.target.value.replace(',', '.'))}
                className="w-full rounded-lg border border-ink/12 px-3 py-2 pr-12 text-sm outline-none transition-colors focus:border-gold"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink/35">
                {currency}
              </span>
            </div>
            <div className="relative w-28">
              <input
                placeholder="Popust"
                inputMode="numeric"
                value={discount}
                onChange={(e) => setDiscount(e.target.value.replace(/\D/g, ''))}
                className="w-full rounded-lg border border-ink/12 px-3 py-2 pr-7 text-sm outline-none transition-colors focus:border-gold"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink/35">
                %
              </span>
            </div>
          </div>
        </div>
      </div>

      <textarea
        placeholder="Opis (opcionalno)"
        value={description ?? ''}
        onChange={(e) => setDescription(e.target.value)}
        rows={2}
        className="mt-3 w-full resize-none rounded-lg border border-ink/12 px-3 py-2 text-sm outline-none transition-colors focus:border-gold"
      />

      <label className="mt-3 flex cursor-pointer items-center gap-2.5">
        <input
          type="checkbox"
          checked={isFeatured}
          onChange={(e) => setIsFeatured(e.target.checked)}
          className="h-4 w-4 accent-[#d4af37]"
        />
        <span className="flex items-center gap-1.5 text-sm">
          <Star className="h-3.5 w-3.5 fill-gold text-gold" />
          Istaknut artikal (specijalna ponuda)
        </span>
      </label>

      {error && <p className="mt-3 text-sm text-red-500">{error}</p>}

      <button
        onClick={() => save.mutate()}
        disabled={!name.trim() || !price || save.isPending}
        className="btn-glossy mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-gold py-2.5 text-sm font-semibold text-neutral-900 transition-colors disabled:opacity-50"
      >
        {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
        Sačuvaj
      </button>
    </ModalShell>
  );
}

// ================================================================
// Zajednički modal okvir
// ================================================================

function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
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
          <h3 className="font-display text-lg font-bold">{title}</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-ink/40 transition-colors hover:bg-ink/5 hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </motion.div>
    </motion.div>
  );
}
