import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthenticationService } from '../services/authentication';


export const authGuard: CanActivateFn = () => {

  const router = inject(Router);

  const authenticationService =
    inject(AuthenticationService);

  const token =
    authenticationService.getToken();

  if (token) {

    return true;

  }

  return router.createUrlTree([
    '/login'
  ]);

};