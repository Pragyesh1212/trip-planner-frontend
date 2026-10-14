import { CommonModule, DatePipe } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Component, EventEmitter, OnInit, Output, signal } from '@angular/core';

interface HotelBooking {
  booking_id: string;
  checkin?: string | null;
  checkout?: string | null;
  confirmation_code?: string | null;
  currency?: string | null;
  guest?: { first_name?: string; last_name?: string; email?: string; phone?: string };
  hotel_name?: string | null;
  price?: number | string | null;
  provider?: string | null;
  status?: string | null;
}
interface HotelBookingsResponse { bookings?: HotelBooking[]; }

@Component({
  selector: 'app-hotel-bookings',
  standalone: true,
  imports: [CommonModule, DatePipe],
  templateUrl: './hotel-bookings.html',
  styleUrl: './hotel-bookings.css'
})
export class HotelBookings implements OnInit {
  @Output() back = new EventEmitter<void>();
  readonly bookings = signal<HotelBooking[]>([]);
  readonly loading = signal(true);
  readonly errorMessage = signal('');
  // Match this URL to the backend base URL used by your PlannerService if different.
  private readonly apiUrl = 'http://127.0.0.1:8000/planner/hotel-bookings';

  constructor(private readonly http: HttpClient) {}

  ngOnInit(): void { this.loadBookings(); }

  loadBookings(): void {
    this.loading.set(true);
    this.errorMessage.set('');
    this.http.get<HotelBookingsResponse>(this.apiUrl, { headers: this.authHeaders() }).subscribe({
      next: response => {
        this.bookings.set(Array.isArray(response?.bookings) ? response.bookings : []);
        this.loading.set(false);
      },
      error: error => {
        console.error('Could not load hotel bookings:', error);
        const detail = error?.error?.detail;
        this.errorMessage.set(typeof detail === 'string' ? detail : detail?.message || error?.error?.message || 'Unable to load hotel bookings. Please check your connection and try again.');
        this.loading.set(false);
      }
    });
  }

  goToPlanner(): void { this.back.emit(); }

  private authHeaders(): HttpHeaders {
    const token = sessionStorage.getItem('access_token');
    return token
      ? new HttpHeaders({ Authorization: `Bearer ${token}` })
      : new HttpHeaders();
  }

  formatPrice(price: number | string | null | undefined, currency?: string | null): string {
    if (price === null || price === undefined || price === '') return 'Price unavailable';
    const amount = Number(price);
    if (!Number.isFinite(amount)) return 'Price unavailable';
    const code = currency || 'INR';
    try { return new Intl.NumberFormat('en-IN', { style: 'currency', currency: code, maximumFractionDigits: 2 }).format(amount); }
    catch { return `${code} ${amount.toLocaleString('en-IN')}`; }
  }
}
