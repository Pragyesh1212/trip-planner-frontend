import { ChangeDetectorRef, Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { AuthenticationService } from '../../services/authentication';


@Component({
  selector: 'app-login',
  imports: [FormsModule,RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class Login {

  email = '';

  password = '';

  errorMessage = '';

  isLoading = false;


  constructor(
    private authenticationService: AuthenticationService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}


  login(): void {

    this.errorMessage = '';

    if (!this.email || !this.password) {

      this.errorMessage =
        'Please enter your email and password.';

      this.cdr.detectChanges();

      return;
    }


    this.isLoading = true;

    this.cdr.detectChanges();


    this.authenticationService.login({
      email: this.email,
      password: this.password
    }).subscribe({

      next: (response) => {

        this.isLoading = false;

        this.authenticationService.saveToken(
          response.access_token
        );

        console.log(
          'Login successful. Token saved.'
        );

        this.cdr.detectChanges();

        this.router.navigate(['/planner'], { replaceUrl: true });

      },


      error: (error) => {

        console.log(
          'Login error:',
          error
        );


        this.isLoading = false;


        if (error.status === 401) {

          this.errorMessage =
            'Invalid password.';

        }
        else if (error.status === 404) {

          this.cdr.detectChanges();

          this.router.navigate(
            ['/signup'],
            {
              queryParams: {
                message: 'User not registered'
              }
            }
          );

          return;

        }
        else {

          this.errorMessage =
            error.error?.detail ||
            'Login failed. Please try again.';

        }


        this.cdr.detectChanges();

      }

    });

  }

}