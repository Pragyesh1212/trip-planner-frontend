import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  ActivatedRoute,
  Router,
  RouterLink
} from '@angular/router';

import { AuthenticationService } from '../../services/authentication';


@Component({
  selector: 'app-signup',
  imports: [
    FormsModule,
    RouterLink
  ],
  templateUrl: './signup.html',
  styleUrl: './signup.css'
})
export class Signup {

  name = '';

  email = '';

  password = '';

  errorMessage = '';

  successMessage = '';

  isLoading = false;


  constructor(
    private authenticationService: AuthenticationService,
    private router: Router,
    private activatedRoute: ActivatedRoute
  ) {

    this.activatedRoute.queryParams.subscribe(
      (params) => {

        const message = params['message'];

        if (message) {

          this.errorMessage = message;

        }

      }
    );

  }


  signup(): void {

    this.errorMessage = '';

    this.successMessage = '';


    if (
      !this.name ||
      !this.email ||
      !this.password
    ) {

      this.errorMessage =
        'Please fill in all fields.';

      return;
    }


    this.isLoading = true;


    this.authenticationService.signup({
      name: this.name,
      email: this.email,
      password: this.password
    }).subscribe({

      next: () => {

        this.isLoading = false;

        this.successMessage =
          'Account created successfully. Redirecting to login...';


        setTimeout(() => {

          this.router.navigate([
            '/login'
          ]);

        }, 1000);

      },


      error: (error) => {

        this.isLoading = false;

        this.errorMessage =
          error.error?.detail ||
          'Signup failed. Please try again.';

      }

    });

  }

}