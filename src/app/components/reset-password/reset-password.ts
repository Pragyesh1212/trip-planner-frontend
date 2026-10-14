import {
  ChangeDetectorRef,
  Component,
  OnInit
} from '@angular/core';

import {
  FormsModule
} from '@angular/forms';

import {
  ActivatedRoute,
  Router
} from '@angular/router';

import {
  AuthenticationService
} from '../../services/authentication';


@Component({
  selector: 'app-reset-password',
  imports: [
    FormsModule
  ],
  templateUrl: './reset-password.html',
  styleUrl: './reset-password.css'
})
export class ResetPassword implements OnInit {

  email = '';

  newPassword = '';

  confirmPassword = '';

  errorMessage = '';

  successMessage = '';

  isLoading = false;


  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private authenticationService: AuthenticationService,
    private cdr: ChangeDetectorRef
  ) {}


  ngOnInit(): void {

    this.route.queryParams.subscribe(
      (params) => {

        this.email =
          params['email'] || '';

      }
    );

  }


  resetPassword(): void {

    this.errorMessage = '';

    this.successMessage = '';


    if (!this.email) {

      this.errorMessage =
        'Email information is missing. Please start again.';

      this.cdr.detectChanges();

      return;

    }


    if (!this.newPassword) {

      this.errorMessage =
        'Please enter a new password.';

      this.cdr.detectChanges();

      return;

    }


    if (this.newPassword.length < 6) {

      this.errorMessage =
        'Password must be at least 6 characters long.';

      this.cdr.detectChanges();

      return;

    }


    if (!this.confirmPassword) {

      this.errorMessage =
        'Please confirm your new password.';

      this.cdr.detectChanges();

      return;

    }


    if (
      this.newPassword !==
      this.confirmPassword
    ) {

      this.errorMessage =
        'Passwords do not match.';

      this.cdr.detectChanges();

      return;

    }


    this.isLoading = true;

    this.cdr.detectChanges();


    this.authenticationService
      .resetPassword(
        this.email,
        this.newPassword
      )
      .subscribe({

        next: (response) => {

          this.isLoading = false;

          this.successMessage =
            response.message;

          this.cdr.detectChanges();


          setTimeout(() => {

            this.router.navigate([
              '/login'
            ]);

          }, 1500);

        },


        error: (error) => {

          this.isLoading = false;

          this.errorMessage =
            error.error?.detail ||
            'Password reset failed. Please try again.';

          this.cdr.detectChanges();

        }

      });

  }


  goToLogin(): void {

    this.router.navigate([
      '/login'
    ]);

  }

}