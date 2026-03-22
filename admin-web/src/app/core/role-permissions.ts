export interface NavPage {
  label: string;
  icon:  string;
  route: string;
}

export const ALL_PAGES: NavPage[] = [
  { label: 'Dashboard',    icon: 'dashboard',        route: '/dashboard' },
  { label: 'Menu',         icon: 'menu_book',         route: '/menu' },
  { label: 'Plan de salle',icon: 'table_restaurant',  route: '/floor/default' },
  { label: 'Cuisine',      icon: 'soup_kitchen',      route: '/kitchen' },
  { label: 'Historique',   icon: 'receipt_long',      route: '/orders' },
  { label: 'Équipe',       icon: 'people',            route: '/staff' },
];

export const ROLE_PAGES: Record<string, string[]> = {
  OWNER:   ['/dashboard', '/menu', '/floor/default', '/kitchen', '/orders', '/staff'],
  MANAGER: ['/dashboard', '/menu', '/floor/default', '/kitchen', '/orders'],
  CASHIER: ['/dashboard', '/orders'],
  KITCHEN: ['/kitchen'],
  WAITER:  ['/kitchen', '/floor/default'],
};

export function getPagesForRole(role: string): NavPage[] {
  const allowed = ROLE_PAGES[role] ?? [];
  return ALL_PAGES.filter(p => allowed.includes(p.route));
}
