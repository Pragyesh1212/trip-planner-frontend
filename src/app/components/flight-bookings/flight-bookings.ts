
import { CommonModule } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import {
  ChangeDetectorRef,
  Component,
  EventEmitter,
  OnInit,
  Output
} from '@angular/core';
import { finalize } from 'rxjs';

export interface AirportSummary {
  city_name?: string | null;
  iata_code?: string | null;
  name?: string | null;
}

export interface FlightBookingRecord {
  booking_id?: string;
  provider?: string | null;
  booking_type?: string | null;
  origin?: string | AirportSummary | null;
  destination?: string | AirportSummary | null;
  departure_date?: string | null;
  return_date?: string | null;
  price?: number | string | null;
  currency?: string | null;
  booking_reference?: string | null;
  provider_order_id?: string | null;
  status?: string | null;
  created_at?: string | null;
  converted_price_inr?: number;
}

interface FlightBookingsResponse {
  bookings?: FlightBookingRecord[];
}

interface ExchangeRateResponse {
  result?: string;
  rates?: Record<string, number>;
}

@Component({
  selector: 'app-flight-bookings',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './flight-bookings.html',
  styleUrl: './flight-bookings.css'
})
export class FlightBookingsComponent implements OnInit {
  @Output() back = new EventEmitter<void>();

  private readonly apiUrl = 'http://127.0.0.1:8000/planner';
  private readonly exchangeRateApiUrl =
    'https://open.er-api.com/v6/latest';

  bookings: FlightBookingRecord[] = [];
  loading = false;
  errorMessage = '';

  constructor(
    private readonly http: HttpClient,
    private readonly cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadBookings();
  }

  loadBookings(): void {
    this.loading = true;
    this.errorMessage = '';
    this.bookings = [];
    this.cdr.detectChanges();

    this.http
      .get<FlightBookingsResponse | FlightBookingRecord[]>(
        `${this.apiUrl}/flight-bookings`,
        { headers: this.authHeaders() }
      )
      .pipe(
        finalize(() => {
          this.loading = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: response => {
          console.log('Flight bookings API response:', response);

          if (Array.isArray(response)) {
            this.bookings = response;
          } else if (Array.isArray(response?.bookings)) {
            this.bookings = response.bookings;
          } else {
            this.bookings = [];
            console.warn(
              'Unexpected flight bookings response format:',
              response
            );
          }

          this.bookings.forEach(booking =>
            this.convertBookingPrice(booking)
          );

          this.loading = false;

          console.log('Bookings count:', this.bookings.length);
          console.log('Loading state:', this.loading);

          this.cdr.detectChanges();
        },

        error: error => {
          console.error('Flight bookings API error:', error);
          this.bookings = [];

          if (error.status === 401) {
            this.errorMessage =
              'Your session has expired. Please log in again.';
          } else if (error.status === 404) {
            this.errorMessage =
              'The flight bookings API was not found.';
          } else {
            this.errorMessage =
              error.error?.detail ||
              'Unable to load your flight bookings. Please try again.';
          }

          this.loading = false;
          this.cdr.detectChanges();
        }
      });
  }

  private convertBookingPrice(booking: FlightBookingRecord): void {
    const amount = Number(booking.price);
    const currency = (booking.currency || '').toUpperCase();

    if (
      booking.price === null ||
      booking.price === undefined ||
      booking.price === '' ||
      !Number.isFinite(amount) ||
      amount < 0
    ) {
      return;
    }

    if (currency === 'INR') {
      booking.converted_price_inr = amount;
      return;
    }

    if (!currency) {
      return;
    }

    this.http
      .get<ExchangeRateResponse>(
        `${this.exchangeRateApiUrl}/${encodeURIComponent(currency)}`
      )
      .subscribe({
        next: response => {
          const rate = response.rates?.['INR'];

          if (
            response.result === 'success' &&
            typeof rate === 'number' &&
            Number.isFinite(rate) &&
            rate > 0
          ) {
            booking.converted_price_inr =
              Math.round(amount * rate * 100) / 100;
          } else {
            console.warn(
              'INR exchange rate unavailable for:',
              currency
            );
          }

          this.cdr.detectChanges();
        },

        error: error => {
          console.error(
            `Could not convert ${currency} to INR:`,
            error
          );
          this.cdr.detectChanges();
        }
      });
  }

  onBack(): void {
    this.back.emit();
  }

  formatAirport(value?: string | AirportSummary | null): string {
    if (!value) {
      return 'Airport unavailable';
    }

    if (typeof value === 'string') {
      return value;
    }

    const city = value.city_name?.trim();
    const code = value.iata_code?.trim();

    if (city && code) {
      return `${city} (${code})`;
    }

    if (city) {
      return city;
    }

    if (code) {
      return code;
    }

    return value.name || 'Airport unavailable';
  }

  formatDate(value?: string | null): string {
    if (!value) {
      return 'Not available';
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return date.toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  formatPrice(booking: FlightBookingRecord): string {
    const amount = Number(booking.price);
    const currency = (booking.currency || '').toUpperCase();

    if (
      booking.price === null ||
      booking.price === undefined ||
      booking.price === '' ||
      !Number.isFinite(amount)
    ) {
      return 'Price unavailable';
    }

    if (currency === 'INR') {
      return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 2
      }).format(amount);
    }

    if (booking.converted_price_inr !== undefined) {
      return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 2
      }).format(booking.converted_price_inr);
    }

    if (!currency) {
      return 'Currency unavailable';
    }

    return `Converting ${amount.toFixed(2)} ${currency} to INR…`;
  }

  trackBooking(
    index: number,
    booking: FlightBookingRecord
  ): string {
    return (
      booking.booking_id ||
      booking.provider_order_id ||
      `${booking.booking_reference || 'booking'}-${index}`
    );
  }

  private authHeaders(): HttpHeaders {
    const token = sessionStorage.getItem('access_token');

    return token
      ? new HttpHeaders({
          Authorization: `Bearer ${token}`
        })
      : new HttpHeaders();
  }
}
