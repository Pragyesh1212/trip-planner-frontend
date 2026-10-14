import { Routes } from '@angular/router';

import { Home } from './components/home/home';
import { Login } from './components/login/login';
import { Signup } from './components/signup/signup';
import { ForgotPassword } from './components/forgot-password/forgot-password';
import { ResetPassword } from './components/reset-password/reset-password';
import { Planner } from './components/planner/planner';
import { HotelBookings } from './components/hotel-bookings/hotel-bookings';

import { authGuard } from './guards/auth-guard';


export const routes: Routes = [
  {
    path: '',
    component: Home
  },

  {
    path: 'login',
    component: Login
  },

  {
    path: 'signup',
    component: Signup
  },

  {
    path: 'forgot-password',
    component: ForgotPassword
  },

  {
    path: 'reset-password',
    component: ResetPassword
  },

  {
    path: 'planner',
    component: Planner,
    canActivate: [authGuard]
  },

  {
    path: 'hotel-bookings',
    component: HotelBookings,
    canActivate: [authGuard]
  },

  {
    path: '**',
    redirectTo: ''
  }
];