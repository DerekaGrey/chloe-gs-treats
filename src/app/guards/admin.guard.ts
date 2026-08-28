import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { getAuth } from 'firebase/auth';
import { IdleTimeoutService } from '../services/idle-timeout.service';

// Uses auth.authStateReady() so the guard works on first page-load when
// Firebase is still restoring the session from local persistence.
export const adminGuard: CanActivateFn = async () => {
  const router = inject(Router);
  const idle = inject(IdleTimeoutService);
  const auth = getAuth();

  await auth.authStateReady();

  const user = auth.currentUser;
  if (!user) return router.createUrlTree(['/admin/login']);

  const { claims } = await user.getIdTokenResult();
  if (claims['admin'] !== true) return router.createUrlTree(['/admin/login']);

  idle.start();
  return true;
};
