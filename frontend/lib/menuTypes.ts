/** Tipovi odgovora API-ja za meni (admin tree i javni meni). */

export interface ItemTranslation {
  lang: string;
  name: string;
  description?: string | null;
}

export interface MenuItemRow {
  id: number;
  categoryId?: number;
  name: string;
  description: string | null;
  price: string; // Decimal serijaliziran kao string
  imagePath: string | null;
  discountPercent: number | null;
  isFeatured: boolean;
  isAvailable?: boolean;
  sortOrder?: number;
  stockQty?: number | null;
  lowStockAt?: number | null;
  translations: ItemTranslation[];
}

export interface MenuCategoryRow {
  id: number;
  menuId?: number;
  name: string;
  kind: 'food' | 'drink' | 'promo';
  sortOrder?: number;
  isActive?: boolean;
  translations: { lang: string; name: string }[];
  items: MenuItemRow[];
}

export interface AdminMenuTree {
  id: number;
  venueId: number;
  name: string;
  isActive: boolean;
  categories: MenuCategoryRow[];
}

export interface VenueTheme {
  primaryColor?: string;
  backgroundColor?: string;
  textColor?: string;
  mode?: 'dark' | 'light';
  backgroundImagePath?: string;
}

export interface PublicMenu {
  id: number;
  slug: string;
  name: string;
  logoPath: string | null;
  address: string | null;
  phone: string | null;
  currency: string;
  defaultLang: string;
  theme: VenueTheme | null;
  googleReviewUrl?: string | null;
  reviewGateEnabled?: boolean;
  wheelEnabled?: boolean;
  wheelPercentage?: number | null;
  promoImagePath?: string | null;
  promoCaption?: string | null;
  categories: MenuCategoryRow[];
}

export const UPLOADS_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export const imageUrl = (path: string | null | undefined) =>
  path ? `${UPLOADS_URL}/uploads/${path}` : null;

/** Ista logika kao backend finalPrice — za prikaz. */
export const finalPrice = (price: string | number, discountPercent: number | null): number => {
  const p = typeof price === 'string' ? parseFloat(price) : price;
  if (!discountPercent) return p;
  return Math.round(p * (100 - discountPercent)) / 100;
};

export const fmtPrice = (value: number, currency: string) =>
  `${value.toFixed(2)} ${currency}`;
