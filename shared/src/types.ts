export const ROLES = ['superadmin', 'client', 'staff'] as const;
export type Role = (typeof ROLES)[number];

export const STAFF_ROLES = ['manager', 'waiter', 'kitchen'] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

/** Odgovor /api/auth/me — uključuje kontekst za role-based UI. */
export interface MeResponse extends AuthUser {
  staff: { venueId: number; role: StaffRole; venueName: string } | null;
  venues: { id: number; name: string; slug: string }[];
  events: { id: number; name: string; slug: string }[];
}

export const ORDER_STATUSES = ['pending', 'accepted', 'rejected', 'completed'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const CATEGORY_KINDS = ['food', 'drink', 'promo'] as const;
export type CategoryKind = (typeof CATEGORY_KINDS)[number];

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
