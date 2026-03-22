import { inject }                        from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot } from '@angular/router';
import { AuthService }                   from '../services/auth.service';
import { ROLE_PAGES }                    from '../role-permissions';

export const authGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const auth   = inject(AuthService);
  const router = inject(Router);

  if (!auth.isAuthenticated()) return router.createUrlTree(['/login']);

  const role    = auth.role();
  const allowed = ROLE_PAGES[role] ?? [];
  if (allowed.length === 0) return true;

  // Compare le premier segment du chemin demandé avec les pages autorisées
  const currentFirst = route.url[0]?.path ?? '';
  const hasAccess = allowed.some(p => p.split('/')[1] === currentFirst);

  if (!hasAccess) return router.createUrlTree([allowed[0]]);

  return true;
};
