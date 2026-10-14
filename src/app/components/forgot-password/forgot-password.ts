import {
  ChangeDetectorRef,
  Component
} from '@angular/core';

import {
  FormsModule
} from '@angular/forms';

import {
  RouterLink,
  Router
} from '@angular/router';

import {
  AuthenticationService
} from '../../services/authentication';


@Component({
  selector: 'app-forgot-password',
  imports: [
    FormsModule,
    RouterLink
  ],
  templateUrl: './forgot-password.html',
  styleUrl: './forgot-password.css'
})
export class ForgotPassword {

  email = '';

  errorMessage = '';

  successMessage = '';

  isLoading = false;


  constructor(
    private authenticationService: AuthenticationService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}


  submit(): void {

    this.errorMessage = '';

    this.successMessage = '';


    if (!this.email) {

      this.errorMessage =
        'Please enter your email address.';

      this.cdr.detectChanges();

      return;

    }


    this.isLoading = true;

    this.cdr.detectChanges();


    this.authenticationService
      .forgotPassword(this.email)
      .subscribe({

        next: (response) => {

          this.isLoading = false;

          this.successMessage =
            response.message;

          this.cdr.detectChanges();


          setTimeout(() => {

            this.router.navigate(
              ['/reset-password'],
              {
                queryParams: {
                  email: this.email
                }
              }
            );

          }, 1000);

        },


        error: (error) => {

          this.isLoading = false;


          if (error.status === 404) {

            this.errorMessage =
              'This email is not registered.';

          }
          else {

            this.errorMessage =
              error.error?.detail ||
              'Something went wrong. Please try again.';

          }


          this.cdr.detectChanges();

        }

      });

  }

}