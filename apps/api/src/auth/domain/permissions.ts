export const Permissions = {
  // Orders
  ORDERS_READ: 'orders.read',
  ORDERS_WRITE: 'orders.write',
  ORDERS_ACCEPT: 'orders.accept',
  ORDERS_REJECT: 'orders.reject',
  ORDERS_SERVE: 'orders.serve',
  ITEMS_WRITE: 'items.write',

  // Tables
  TABLES_READ: 'tables.read',
  TABLES_WRITE: 'tables.write',

  // Menu
  MENU_READ: 'menu.read',
  MENU_UPDATE: 'menu.update',

  // Customer Sessions
  SESSIONS_READ: 'sessions.read',
  SESSIONS_WRITE: 'sessions.write',

  // Payments
  PAYMENTS_READ: 'payments.read',
  PAYMENTS_WRITE: 'payments.write',

  // Administration & Reports
  STAFF_READ: 'staff.read',
  STAFF_MANAGE: 'staff.manage',
  REPORTS_READ: 'reports.read',
  INVENTORY_READ: 'inventory.read',
} as const;

export type Permission = (typeof Permissions)[keyof typeof Permissions] | string;
