import { CanActivateFn } from '@angular/router';

export const adminGuard: CanActivateFn = (route, state) => {
  // TODO: Implement actual admin role verification
  return true;
};
