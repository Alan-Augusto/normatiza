import { CanActivateFn } from '@angular/router';

export const authGuard: CanActivateFn = (route, state) => {
  // TODO: Implement actual authentication check (e.g., check token, inject AuthService)
  return true;
};
