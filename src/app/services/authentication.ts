import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';


interface SignupRequest {
  name: string;
  email: string;
  password: string;
}


interface LoginRequest {
  email: string;
  password: string;
}


interface SignupResponse {
  message: string;
  user_id: string;
}


interface LoginResponse {
  message: string;
  access_token: string;
  token_type: string;
}


export interface CurrentUserResponse {
  id: string;
  name: string;
  email: string;
}


interface ForgotPasswordRequest {
  email: string;
}


interface ForgotPasswordResponse {
  message: string;
}


interface ResetPasswordRequest {
  email: string;
  new_password: string;
}


interface ResetPasswordResponse {
  message: string;
}


@Injectable({
  providedIn: 'root'
})
export class AuthenticationService {

  private readonly apiUrl ='/api/v1/authentication';

  private readonly tokenKey =
    'access_token';


  constructor(
    private http: HttpClient
  ) {}


  signup(user: SignupRequest): Observable<SignupResponse> {

    return this.http.post<SignupResponse>(
      `${this.apiUrl}/signup`,
      user
    );

  }


  login(
    credentials: LoginRequest
  ): Observable<LoginResponse> {

    return this.http.post<LoginResponse>(
      `${this.apiUrl}/login`,
      credentials
    );

  }


  forgotPassword(
    email: string
  ): Observable<ForgotPasswordResponse> {

    const request: ForgotPasswordRequest = {
      email: email
    };

    return this.http.post<ForgotPasswordResponse>(
      `${this.apiUrl}/forgot-password`,
      request
    );

  }


  resetPassword(
    email: string,
    newPassword: string
  ): Observable<ResetPasswordResponse> {

    const request: ResetPasswordRequest = {
      email: email,
      new_password: newPassword
    };

    return this.http.post<ResetPasswordResponse>(
      `${this.apiUrl}/reset-password`,
      request
    );

  }


  saveToken(
    token: string
  ): void {

    sessionStorage.setItem(
      this.tokenKey,
      token
    );

  }


  getToken(): string | null {

    return sessionStorage.getItem(
      this.tokenKey
    );

  }


  isLoggedIn(): boolean {

    return this.getToken() !== null;

  }


  logout(): void {

    sessionStorage.removeItem(
      this.tokenKey
    );

  }


  getCurrentUser(): Observable<CurrentUserResponse> {

    const token =
      this.getToken();

    return this.http.get<CurrentUserResponse>(
      `${this.apiUrl}/me`,
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );

  }

}