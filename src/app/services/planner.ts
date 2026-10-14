
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface SavedConversation {
  conversation_id: string;
  title: string;
  updated_at?: string;
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
    weather?: WeatherForecast | null;
    flights?: FlightOffer[];
    flightDirection?: 'outbound' | 'return' | null;
    selectedOutboundFlight?: FlightOffer | null;
    selectedReturnFlight?: FlightOffer | null;
    suggestedDates?: SuggestedDateRange[];
    bookingActions?: boolean;
    hotels?: HotelOption[];
  }>;
}

export interface PlannerMessageRequest {
  message: string;
  conversation_id: string;
  start_date?: string;
  end_date?: string;
}

export interface WeatherForecast {
  success: boolean;
  forecast_available: boolean;
  location: string;
  admin1?: string | null;
  country?: string | null;
  country_code?: string | null;
  timezone?: string | null;
  dates: string[];
  temperature_max: number[];
  temperature_min: number[];
  precipitation_probability: number[];
  wind_speed: number[];
  weather_code: number[];
}

export interface FlightSegment {
  flight_number?: string | null;
  carrier?: string | null;
  origin?: string | null;
  destination?: string | null;
  departure?: string | null;
  arrival?: string | null;
  duration?: string | null;
}

export interface FlightJourney {
  duration?: string | null;
  segments?: FlightSegment[];
}

export interface FlightOffer {
  offer_id?: string;
  price_inr?: number | string | null;
  total_amount?: number | string | null;
  total_currency?: string | null;
  airline?: string | null;
  airline_iata?: string | null;
  journeys?: FlightJourney[];
}

export interface SuggestedDateRange {
  start_date: string;
  end_date: string;
}

export interface HotelOption {
  hotel_id: string;
  name: string;
  address?: string | null;
  city?: string | null;
  rating?: number | string | null;
  stars?: number | string | null;
  image_url?: string | null;
  room_name?: string | null;
  price?: number | string | null;
  currency?: string | null;
  rate_id?: string | null;
  offer_id?: string | null;
  refundable?: boolean | null;
  cancellation_policy?: string | null;
}


export interface HotelPrebookResponse {
  success: boolean;
  message?: string;
  error?: string;
  prebook_id?: string | null;
  price?: number | string | null;
  currency?: string | null;
}

export interface HotelBookingResponse {
  success: boolean;
  message?: string;
  error?: string;
  booking_id?: string | null;
  hotel_confirmation_code?: string | null;
  status?: string | null;
  price?: number | string | null;
  currency?: string | null;
  checkin?: string | null;
  checkout?: string | null;
  hotel_name?: string | null;
}

export interface HotelBookingRequest {
  prebook_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
}

export interface PlannerMessageResponse {
  message: string;
  response: string;
  next_step: string | null;
  weather?: WeatherForecast | null;
  hotels?: HotelOption[] | null;

  flights?: FlightOffer[] | null;
  outbound_flights?: FlightOffer[] | null;
  return_flights?: FlightOffer[] | null;

  selected_flight?: FlightOffer | null;
  selected_outbound_flight?: FlightOffer | null;
  selected_return_flight?: FlightOffer | null;

  // Alternative travel date suggestions from the backend.
  suggested_dates?: SuggestedDateRange[];
}

@Injectable({
  providedIn: 'root'
})
export class PlannerService {
  private readonly apiUrl = 'http://127.0.0.1:8000/planner';

  constructor(private http: HttpClient) {}

  /** Uses the same access_token key as AuthenticationService. */
  private authHeaders(): HttpHeaders {
    const token = sessionStorage.getItem('access_token');
    return token
      ? new HttpHeaders({ Authorization: `Bearer ${token}` })
      : new HttpHeaders();
  }

  prebookHotel(offerId: string): Observable<HotelPrebookResponse> {
    return this.http.post<HotelPrebookResponse>(
      `${this.apiUrl}/hotels/prebook`,
      { offer_id: offerId },
      { headers: this.authHeaders() }
    );
  }

  bookHotel(request: HotelBookingRequest): Observable<HotelBookingResponse> {
    return this.http.post<HotelBookingResponse>(
      `${this.apiUrl}/hotels/book`,
      request,
      { headers: this.authHeaders() }
    );
  }

  
getConversations(): Observable<{ conversations: SavedConversation[] }> {
  return this.http.get<{ conversations: SavedConversation[] }>(
    `${this.apiUrl}/history`,
    { headers: this.authHeaders() }
  );
}

  getConversation(conversationId: string): Observable<SavedConversation> {
    return this.http.get<SavedConversation>(
      `${this.apiUrl}/history/${encodeURIComponent(conversationId)}`,
      { headers: this.authHeaders() }
    );
  }

  saveConversation(conversation: SavedConversation): Observable<{ success: boolean }> {
    return this.http.put<{ success: boolean }>(
      `${this.apiUrl}/history`,
      conversation,
      { headers: this.authHeaders() }
    );
  }

  sendMessage(
    message: string,
    conversationId: string,
    startDate?: string,
    endDate?: string
  ): Observable<PlannerMessageResponse> {
    const request: PlannerMessageRequest = {
      message,
      conversation_id: conversationId
    };

    if (startDate) {
      request.start_date = startDate;
    }

    if (endDate) {
      request.end_date = endDate;
    }

    return this.http.post<PlannerMessageResponse>(
      `${this.apiUrl}/message`,
      request,
      { headers: this.authHeaders() }
    );
  }
}
