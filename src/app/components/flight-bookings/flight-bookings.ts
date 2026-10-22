
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

export interface PassengerRecord {
  id?: string | null;
  name?: string | null;
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  given_name?: string | null;
  family_name?: string | null;
  passenger_type?: string | null;
  type?: string | null;
  email?: string | null;
  phone?: string | null;
  phone_number?: string | null;
  ticket_number?: string | null;
  ticketNumber?: string | null;
  seat?: string | null;
  seat_number?: string | null;
  cabin_class?: string | null;
  cabin?: string | null;
  baggage_allowance?: string | null;
  baggage?: string | null;
  [key: string]: unknown;
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
  passengers?: PassengerRecord[] | null;
  passenger_details?: PassengerRecord[] | null;
  passenger?: PassengerRecord[] | null;
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

  private readonly apiUrl = '/api/v1/planner';
  private readonly exchangeRateApiUrl =
    'https://open.er-api.com/v6/latest';

  bookings: FlightBookingRecord[] = [];
  selectedBookingId: string | null = null;
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

  toggleBookingDetails(booking: FlightBookingRecord, index: number): void {
    const id = this.trackBooking(index, booking);
    this.selectedBookingId = this.selectedBookingId === id ? null : id;
  }

  isBookingExpanded(booking: FlightBookingRecord, index: number): boolean {
    return this.selectedBookingId === this.trackBooking(index, booking);
  }

  getPassengers(booking: FlightBookingRecord): PassengerRecord[] {
    const candidates = [
      booking.passengers,
      booking.passenger_details,
      booking.passenger
    ];

    for (const candidate of candidates) {
      if (Array.isArray(candidate)) {
        return candidate.filter(
          (item): item is PassengerRecord =>
            !!item && typeof item === 'object'
        );
      }
    }

    return [];
  }

  passengerName(passenger: PassengerRecord, index: number): string {
    const fullName = passenger.full_name || passenger.name;
    if (typeof fullName === 'string' && fullName.trim()) {
      return fullName.trim();
    }

    const firstName = passenger.first_name || passenger.given_name || '';
    const lastName = passenger.last_name || passenger.family_name || '';
    const combinedName = `${firstName} ${lastName}`.trim();

    return combinedName || `Passenger ${index + 1}`;
  }

  trackPassenger(index: number, passenger: PassengerRecord): string {
    return passenger.id || passenger.ticket_number || `${this.passengerName(passenger, index)}-${index}`;
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
