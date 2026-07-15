export const ROLES = ['superadmin', 'client', 'staff'] as const;
export type Role = (typeof ROLES)[number];

export const STAFF_ROLES = ['manager', 'waiter', 'kitchen'] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

/** Moduli admin panela — per-user pristup za članove grupe. */
export const PANEL_MODULES = ['orders', 'menu', 'inventory', 'tasks', 'staff'] as const;
export type PanelModule = (typeof PANEL_MODULES)[number];

export const PANEL_MODULE_LABELS: Record<PanelModule, string> = {
  orders: 'Narudžbe',
  menu: 'Meni',
  inventory: 'Inventar',
  tasks: 'Zadaci',
  staff: 'Osoblje',
};

/** Default pristup po roli — kad član grupe nema eksplicitne permisije. */
export const DEFAULT_MODULE_PERMS: Record<StaffRole, Record<PanelModule, boolean>> = {
  manager: { orders: true, menu: true, inventory: true, tasks: true, staff: true },
  waiter: { orders: true, menu: false, inventory: false, tasks: true, staff: false },
  kitchen: { orders: true, menu: false, inventory: false, tasks: true, staff: false },
};

/** Odgovor /api/auth/me — uključuje kontekst za role-based UI. */
export interface MeResponse extends AuthUser {
  staff: {
    venueId: number;
    role: StaffRole;
    venueName: string;
    /** efektivni per-modul pristup (za članove grupe); null = default po roli */
    permissions?: Record<PanelModule, boolean> | null;
  } | null;
  venues: { id: number; name: string; slug: string }[];
  events: { id: number; name: string; slug: string }[];
}

export const ORDER_STATUSES = ['pending', 'accepted', 'rejected', 'completed'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const CATEGORY_KINDS = ['food', 'drink', 'promo'] as const;
export type CategoryKind = (typeof CATEGORY_KINDS)[number];

/** Jezici prevoda menija (bs = izvor/osnova). */
export const MENU_LANGS = ['bs', 'en', 'de', 'it', 'es', 'fr', 'tr', 'ar'] as const;
export type MenuLang = (typeof MENU_LANGS)[number];

export const MENU_LANG_META: Record<MenuLang, { label: string; flag: string }> = {
  bs: { label: 'Bosanski', flag: '🇧🇦' },
  en: { label: 'English', flag: '🇬🇧' },
  de: { label: 'Deutsch', flag: '🇩🇪' },
  it: { label: 'Italiano', flag: '🇮🇹' },
  es: { label: 'Español', flag: '🇪🇸' },
  fr: { label: 'Français', flag: '🇫🇷' },
  tr: { label: 'Türkçe', flag: '🇹🇷' },
  ar: { label: 'العربية', flag: '🇸🇦' },
};

export interface AuthUser {
  id: number;
  email: string;
  name: string;
  role: Role;
}

/** DTO koji Socket.io šalje admin dashboardu na 'order:new' */
export interface OrderDTO {
  id: number;
  publicId: string;
  venueId: number;
  tableNumber: string;
  note: string | null;
  status: OrderStatus;
  total: string; // DECIMAL serijaliziran kao string
  createdAt: string;
  items: {
    name: string;
    quantity: number;
    unitPrice: string;
    lineTotal: string;
  }[];
}
