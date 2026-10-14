import { Component, OnInit, signal, NgZone, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize, timeout } from 'rxjs';

import { AuthenticationService } from '../../services/authentication';
import {
  PlannerService,
  SavedConversation,
  WeatherForecast,
  FlightOffer,
  HotelOption
} from '../../services/planner';
import { DecimalPipe } from '@angular/common';
import { FlightBookingsComponent } from '../flight-bookings/flight-bookings';
import { HotelBookings } from '../hotel-bookings/hotel-bookings';


interface HotelBookingResponse {
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

interface SuggestedDateRange {
  start_date: string;
  end_date: string;
}

interface ChatMessage {
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
}

interface CalendarDay {
  date: string;
  day: number;
  currentMonth: boolean;
}

@Component({
  selector: 'app-planner',
  standalone: true,
  imports: [FormsModule, DecimalPipe, FlightBookingsComponent, HotelBookings],
  templateUrl: './planner.html',
  styleUrl: './planner.css'
})
export class Planner implements OnInit {
  sidebarOpen = true;
  showFlightBookings = false;
  showHotelBookings = false;
  showMyTrips = false;
  message = '';
  userName = 'User';
  userInitial = 'U';

  isLoading = signal(false);
  errorMessage = signal('');
  chatMessages = signal<ChatMessage[]>([]);
  conversations = signal<SavedConversation[]>([]);

  conversationId: string = crypto.randomUUID();

  calendarOpen = false;
  selectedStartDate = '';
  selectedEndDate = '';
  calendarMonth = new Date();

  // Preserve the selected outbound and return flights.
  selectedOutboundFlight: FlightOffer | null = null;
  selectedReturnFlight: FlightOffer | null = null;

  // Controls the trip-review and passenger-details panels.
  reviewTripOpen = false;
  passengerDetailsOpen = false;
  bookingCreated = false;
  selectedHotelOption: HotelOption | null = null;
  // Compare hotel options by LiteAPI offer ID, not object identity.
  selectedHotelOfferId: string | null = null;
  hotelPrebooking = false;
  hotelPrebookMessage = '';
  hotelPrebookError = '';
  hotelPrebookId: string | null = null;
  hotelPrebookPrice: number | string | null = null;
  hotelPrebookCurrency = 'INR';
  hotelBookingInProgress = false;
  hotelBookingError = '';
  hotelBookingMessage = '';
  hotelBookingResult: HotelBookingResponse | null = null;
  hotelGuest = {
    first_name: '',
    last_name: '',
    email: '',
    phone: ''
  };
  passengerDetails = {
    given_name: '',
    family_name: '',
    title: 'ms',
    gender: 'f',
    born_on: '',
    email: '',
    phone_number: ''
  };
  private nextVisibleUserMessage: string | null = null;

  constructor(
    private authenticationService: AuthenticationService,
    private plannerService: PlannerService,
    private router: Router,
    private ngZone: NgZone,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadCurrentUser();
    this.loadConversations();
  }

  showFlightBookingsView(): void {
    this.showHotelBookings = false;
    this.showMyTrips = false;
    this.showFlightBookings = true;
    this.sidebarOpen = window.innerWidth >= 1024;
  }

  showHotelBookingsView(): void {
    this.showFlightBookings = false;
    this.showMyTrips = false;
    this.showHotelBookings = true;
    this.sidebarOpen = window.innerWidth >= 1024;
  }

  showMyTripsView(): void {
    this.showFlightBookings = false;
    this.showHotelBookings = false;
    this.showMyTrips = true;
    this.loadConversations();
    this.sidebarOpen = window.innerWidth >= 1024;
  }

  backToPlanner(): void {
    this.showFlightBookings = false;
    this.showHotelBookings = false;
    this.showMyTrips = false;
  }

  loadConversations(): void {
    this.plannerService.getConversations().subscribe({
      next: result => this.conversations.set(result.conversations || []),
      error: error => console.error('Could not load conversation history:', error)
    });
  }

  newTrip(): void {
    this.showFlightBookings = false;
    this.showHotelBookings = false;
    this.showMyTrips = false;
    this.conversationId = crypto.randomUUID();
    this.chatMessages.set([]);
    this.selectedOutboundFlight = null;
    this.selectedReturnFlight = null;
    this.reviewTripOpen = false;
    this.passengerDetailsOpen = false;
    this.bookingCreated = false;
    this.selectedHotelOption = null;
    this.selectedHotelOfferId = null;
    this.hotelPrebookId = null;
    this.hotelBookingResult = null;
    this.selectedStartDate = '';
    this.selectedEndDate = '';
    this.calendarOpen = false;
    this.errorMessage.set('');
    this.message = '';
    this.sidebarOpen = window.innerWidth >= 1024;
  }

  openConversation(conversationId: string): void {
    this.plannerService.getConversation(conversationId).subscribe({
      next: conversation => {
        this.conversationId = conversation.conversation_id;
        this.chatMessages.set((conversation.messages || []) as ChatMessage[]);
        this.selectedOutboundFlight = null;
        this.selectedReturnFlight = null;
        this.reviewTripOpen = false;
        this.passengerDetailsOpen = false;
        this.bookingCreated = false;
        this.errorMessage.set('');
        this.sidebarOpen = window.innerWidth >= 1024;
      },
      error: error => {
        console.error('Could not open conversation:', error);
        this.errorMessage.set('Unable to open this conversation. Please try again.');
      }
    });
  }

  private persistCurrentConversation(): void {
    const messages = this.chatMessages();
    if (!messages.length) return;
    const firstUserMessage = messages.find(item => item.role === 'user')?.content || 'New Trip';
    const title = firstUserMessage.length > 48
      ? `${firstUserMessage.slice(0, 45)}...`
      : firstUserMessage;
    this.plannerService.saveConversation({
      conversation_id: this.conversationId,
      title,
      messages
    }).subscribe({
      next: () => this.loadConversations(),
      error: error => console.error('Could not save conversation:', error)
    });
  }

  loadCurrentUser(): void {
    this.authenticationService
      .getCurrentUser()
      .subscribe({
        next: (user) => {
          this.userName = user.name;
          this.userInitial = user.name.charAt(0).toUpperCase();
        },
        error: (error) => {
          console.error('Error loading current user:', error);
        }
      });
  }

  formatAssistantMessage(message: string): string {
    return message
      .replace(/\*\*(.*?)\*\*/gs, '$1')
      .replace(/__(.*?)__/gs, '$1')
      .replace(/(?<!\*)\*(?!\*)(.*?)\*(?!\*)/gs, '$1')
      .replace(/(?<!_)_(?!_)(.*?)_(?!_)/gs, '$1')
      .trim();
  }

  getDisplayableWeather(
    weather: WeatherForecast | null | undefined
  ): WeatherForecast | null {
    if (
      !weather ||
      weather.success !== true ||
      weather.forecast_available !== true ||
      !Array.isArray(weather.dates) ||
      weather.dates.length === 0
    ) {
      return null;
    }

    return weather;
  }

  getFlightDirection(
    nextStep: string | null
  ): 'outbound' | 'return' | null {
    if (nextStep === 'outbound_results') {
      return 'outbound';
    }

    if (nextStep === 'return_results') {
      return 'return';
    }

    return null;
  }

  getFlightTitle(flight: FlightOffer): string {
    const journey = flight.journeys?.[0];
    const segment = journey?.segments?.[0];

    const airline =
      flight.airline ||
      segment?.carrier ||
      'Airline';

    const flightNumber = segment?.flight_number || '';

    return [airline, flightNumber]
      .filter(Boolean)
      .join(' · ');
  }

  getFlightPrice(flight: FlightOffer): string {
    const price = flight.price_inr;

    if (
      price === null ||
      price === undefined ||
      price === ''
    ) {
      return 'Price unavailable';
    }

    const amount = Number(price);

    if (!Number.isFinite(amount)) {
      return 'Price unavailable';
    }

    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2
    }).format(amount);
  }

  /**
   * Convert airport data into readable text.
   * Handles airport objects as well as plain strings.
   */
  private getAirportLabel(value: unknown): string {
    if (typeof value === 'string') {
      return value;
    }

    if (!value || typeof value !== 'object') {
      return 'Airport not provided';
    }

    const airport = value as Record<string, unknown>;

    const possibleLabels = [
      airport['name'],
      airport['airport_name'],
      airport['city_name'],
      airport['iata_code'],
      airport['iata'],
      airport['code'],
      airport['id']
    ];

    for (const label of possibleLabels) {
      if (typeof label === 'string' && label.trim()) {
        return label.trim();
      }
    }

    const nestedAirport =
      airport['airport'] ??
      airport['city'] ??
      airport['location'];

    if (nestedAirport && nestedAirport !== value) {
      const nestedLabel = this.getAirportLabel(nestedAirport);

      if (nestedLabel !== 'Airport not provided') {
        return nestedLabel;
      }
    }

    return 'Airport not provided';
  }

  /**
   * Convert ISO 8601 durations such as PT2H45M
   * into readable values such as 2h 45m.
   */
  formatFlightDuration(
    value: string | number | null | undefined
  ): string {
    if (value === null || value === undefined || value === '') {
      return 'Duration not provided';
    }

    if (typeof value === 'number') {
      if (!Number.isFinite(value) || value < 0) {
        return 'Duration not provided';
      }

      // Numeric durations are treated as minutes.
      const totalMinutes = Math.round(value);
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;

      if (hours > 0 && minutes > 0) {
        return `${hours}h ${minutes}m`;
      }

      if (hours > 0) {
        return `${hours}h`;
      }

      return `${minutes}m`;
    }

    const duration = value.trim();

    if (!duration) {
      return 'Duration not provided';
    }

    // Parse ISO 8601 duration values, e.g. PT2H45M or PT45M.
    const isoMatch = duration.match(
      /^P(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/i
    );

    if (isoMatch) {
      const days = Number(isoMatch[1] || 0);
      const hoursPart = Number(isoMatch[2] || 0);
      const minutesPart = Number(isoMatch[3] || 0);
      const secondsPart = Number(isoMatch[4] || 0);

      const totalMinutes = Math.round(
        days * 24 * 60 +
        hoursPart * 60 +
        minutesPart +
        secondsPart / 60
      );

      if (!Number.isFinite(totalMinutes)) {
        return 'Duration not provided';
      }

      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;

      if (hours > 0 && minutes > 0) {
        return `${hours}h ${minutes}m`;
      }

      if (hours > 0) {
        return `${hours}h`;
      }

      return `${minutes}m`;
    }

    // If the API already supplies a readable duration,
    // retain that value rather than changing it.
    return duration;
  }

  /**
   * Return a display-ready flight segment with normalized
   * airport labels and readable duration.
   */
  getFlightSegment(flight: FlightOffer) {
    const journey = flight.journeys?.[0];
    const segment = journey?.segments?.[0];

    if (!segment) {
      return null;
    }

    const origin = this.getAirportLabel(segment.origin);
    const destination = this.getAirportLabel(segment.destination);

    const rawDuration =
      segment.duration ||
      journey?.duration ||
      null;

    return {
      ...segment,
      origin,
      destination,
      duration: this.formatFlightDuration(rawDuration)
    };
  }

  formatFlightDateTime(
    value: string | null | undefined
  ): string {
    if (!value) {
      return 'Not provided';
    }

    const parsedDate = new Date(value);

    if (Number.isNaN(parsedDate.getTime())) {
      return value;
    }

    return parsedDate.toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  isFlightSelected(
    flight: FlightOffer,
    direction: 'outbound' | 'return'
  ): boolean {
    const selectedFlight =
      direction === 'outbound'
        ? this.selectedOutboundFlight
        : this.selectedReturnFlight;

    return !!selectedFlight &&
      selectedFlight.offer_id === flight.offer_id;
  }

  getHotelOfferId(hotel: HotelOption): string | null {
    const id = hotel?.offer_id || hotel?.rate_id;
    return typeof id === 'string' && id.trim() ? id : null;
  }

  isSelectedHotel(hotel: HotelOption): boolean {
    const id = this.getHotelOfferId(hotel);
    return !!id && id === this.selectedHotelOfferId;
  }

  selectHotel(hotel: HotelOption): void {
    // Log before the guard so we can tell whether the HTML click binding fires.
    console.log('[HOTEL DEBUG] selectHotel called');

    if (this.hotelPrebooking) {
      console.warn('[HOTEL DEBUG] Ignored click: another hotel prebook is still marked pending');
      return;
    }

    const offerId = this.getHotelOfferId(hotel);
    if (!offerId) {
      this.hotelPrebookError =
        'This hotel option is missing its LiteAPI offer ID. Please search again.';
      this.hotelPrebookMessage = '';
      this.hotelPrebookId = null;
      return;
    }

    this.selectedHotelOption = hotel;
    this.selectedHotelOfferId = offerId;
    this.hotelPrebooking = true;
    this.hotelPrebookMessage = '';
    this.hotelPrebookError = '';
    this.hotelPrebookId = null;
    this.hotelPrebookPrice = null;
    this.cdr.detectChanges();

    console.debug('[HOTEL DEBUG] Sending prebook request', {
      hasOfferId: !!hotel.offer_id,
      offerIdLength: offerId.length,
      offerIdPrefix: offerId.slice(0, 12)
    });

    this.plannerService
      .prebookHotel(offerId)
      .pipe(
        // Never leave the UI locked if the HTTP observable fails to complete.
        // A real response should arrive well before this 20-second safety limit.
        timeout({ first: 20000 }),
        finalize(() => {
          // HttpClient normally runs in Angular's zone, but explicitly re-enter it
          // so the non-signal template fields refresh even in zoneless/custom setups.
          this.ngZone.run(() => {
            this.hotelPrebooking = false;
            this.cdr.detectChanges();
            console.debug('[HOTEL DEBUG] Prebook request finalized; loading cleared');
          });
        })
      )
      .subscribe({
        next: (result) => {
          this.ngZone.run(() => {
            console.debug('[HOTEL DEBUG] Prebook response received', result);

            if (!result?.success || !result.prebook_id) {
              this.hotelPrebookError =
                result?.error ||
                result?.message ||
                'LiteAPI could not revalidate this room. Please choose another rate.';
              this.cdr.detectChanges();
              return;
            }

            this.hotelPrebookId = result.prebook_id;
            this.hotelPrebookPrice = result.price ?? hotel.price ?? null;
            this.hotelPrebookCurrency = result.currency || hotel.currency || 'INR';
            this.hotelPrebookMessage =
              'Room rate revalidated successfully. No hotel reservation has been made and no payment has been taken.';
            this.cdr.detectChanges();
          });
        },
        error: (error) => {
          this.ngZone.run(() => {
            this.hotelPrebookError =
              (error?.name === 'TimeoutError'
                ? 'Hotel rate check timed out after 20 seconds. Please select the room again.'
                : null) ||
              error?.error?.detail?.message ||
              error?.error?.detail ||
              error?.error?.error ||
              error?.error?.message ||
              'Could not revalidate this room. Please try again.';
            console.error('[HOTEL DEBUG] Prebook request failed', error);
            this.cdr.detectChanges();
          });
        }
      });
  }

  bookSelectedHotel(): void {
    if (this.hotelBookingInProgress) return;

    if (!this.hotelPrebookId) {
      this.hotelBookingError = 'Please revalidate the room rate before booking.';
      return;
    }

    const firstName = this.hotelGuest.first_name.trim();
    const lastName = this.hotelGuest.last_name.trim();
    const email = this.hotelGuest.email.trim();
    const phone = this.hotelGuest.phone.trim();

    if (!firstName || !lastName || !email || !phone) {
      this.hotelBookingError = 'Please complete all guest details before continuing.';
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      this.hotelBookingError = 'Please enter a valid email address.';
      return;
    }

    this.hotelBookingInProgress = true;
    this.hotelBookingError = '';
    this.hotelBookingMessage = '';
    this.hotelBookingResult = null;
    this.cdr.detectChanges();

    this.plannerService.bookHotel({
      prebook_id: this.hotelPrebookId,
      first_name: firstName,
      last_name: lastName,
      email,
      phone
    }).pipe(
      // Always leave the loading state, including success, HTTP errors, and timeout.
      finalize(() => {
        this.ngZone.run(() => {
          this.hotelBookingInProgress = false;
          this.cdr.detectChanges();
        });
      })
    ).subscribe({
      next: (result) => {
        // Ensure the view updates even if the HTTP callback was triggered outside Angular's zone.
        this.ngZone.run(() => {
          console.info('[HOTEL DEBUG] Booking response received', {
            success: result?.success,
            hasBookingId: Boolean(result?.booking_id),
            status: result?.status
          });

          if (!result?.success || !result.booking_id) {
            this.hotelBookingError =
              result?.error || result?.message ||
              'LiteAPI did not return a confirmed booking ID. Please check the booking response before retrying.';
            this.hotelBookingResult = null;
            this.cdr.detectChanges();
            return;
          }

          // Keep the complete backend response for the confirmation panel.
          this.hotelBookingResult = { ...result };
          this.hotelBookingMessage = result.message || 'Hotel booking confirmation received.';
          this.hotelBookingError = '';
          this.hotelPrebookId = null;
          this.cdr.detectChanges();
        });
      },
      error: (error) => {
        this.ngZone.run(() => {
          const detail = error?.error?.detail;
          this.hotelBookingError =
            (typeof detail === 'string' ? detail : detail?.message || detail?.error) ||
            error?.error?.message ||
            'Hotel booking failed. Please review the details and try again.';
          console.error('[HOTEL DEBUG] Hotel booking request failed', {
            status: error?.status,
            message: this.hotelBookingError,
            body: error?.error
          });
          this.cdr.detectChanges();
        });
      }
    });
  }

  selectFlight(
    flight: FlightOffer,
    index: number,
    direction: 'outbound' | 'return'
  ): void {
    if (this.isLoading()) {
      return;
    }

    if (direction === 'outbound') {
      this.selectedOutboundFlight = flight;
    } else {
      this.selectedReturnFlight = flight;
    }

    this.reviewTripOpen = false;

    // Preserve the existing backend selection flow.
    this.message = `option ${index + 1}`;
    this.sendMessage();
  }

  getCombinedFlightPrice(): string {
    // Duffel round-trip offers already contain both journeys and one total fare.
    const offer = this.selectedOutboundFlight;
    if (offer && (offer.journeys?.length ?? 0) >= 2) {
      return this.getFlightPrice(offer);
    }

    // Backward compatibility for the older two-separate-offers flow.
    if (!offer || !this.selectedReturnFlight) {
      return 'Complete round-trip price unavailable';
    }
    const outboundPrice = Number(offer.price_inr);
    const returnPrice = Number(this.selectedReturnFlight.price_inr);
    if (!Number.isFinite(outboundPrice) || !Number.isFinite(returnPrice)) {
      return 'Combined price unavailable';
    }
    return new Intl.NumberFormat('en-IN', {
      style: 'currency', currency: 'INR', maximumFractionDigits: 2
    }).format(outboundPrice + returnPrice);
  }

  getFlightSegmentAt(flight: FlightOffer, journeyIndex: number) {
    const journey = flight.journeys?.[journeyIndex];
    const segment = journey?.segments?.[0];
    if (!segment) return null;
    return {
      ...segment,
      origin: this.getAirportLabel(segment.origin),
      destination: this.getAirportLabel(segment.destination),
      duration: this.formatFlightDuration(segment.duration || journey?.duration || null)
    };
  }

  hasCompleteRoundTrip(flight: FlightOffer | null | undefined): boolean {
    return !!flight && (flight.journeys?.length ?? 0) >= 2;
  }

  // Keep compatibility with the existing HTML template.
  getRoundTripTotal(): string {
    return this.getCombinedFlightPrice();
  }

  openTripReview(): void {
    if (!this.selectedOutboundFlight) return;
    // One Duffel round-trip offer contains both journeys; separate-leg offers
    // remain supported for backward compatibility.
    if (!this.hasCompleteRoundTrip(this.selectedOutboundFlight) && !this.selectedReturnFlight) return;
    this.reviewTripOpen = true;
  }

  closeTripReview(): void {
    this.reviewTripOpen = false;
  }

  handleEnterKey(event: Event): void {
    const keyboardEvent = event as KeyboardEvent;

    if (keyboardEvent.shiftKey) {
      return;
    }

    event.preventDefault();
    this.sendMessage();
  }

  /**
   * Send a suggested alternative date range through the
   * same date-submission flow used by the existing calendar.
   */
  chooseSuggestedDates(dateRange: SuggestedDateRange): void {
    if (this.isLoading()) {
      return;
    }

    if (
      !dateRange ||
      !this.isValidDateString(dateRange.start_date) ||
      !this.isValidDateString(dateRange.end_date) ||
      dateRange.end_date < dateRange.start_date
    ) {
      this.errorMessage.set(
        'The suggested travel dates are invalid. Please select your dates again.'
      );
      return;
    }

    this.errorMessage.set('');

    this.selectedStartDate = dateRange.start_date;
    this.selectedEndDate = dateRange.end_date;

    // Reuse the existing date-submission flow.
    this.updateDates();
  }

  /**
   * Validate YYYY-MM-DD without allowing JavaScript to
   * silently normalize invalid dates.
   */
  private isValidDateString(value: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return false;
    }

    const parsedDate = new Date(`${value}T00:00:00`);

    return !Number.isNaN(parsedDate.getTime()) &&
      this.formatDate(parsedDate) === value;
  }

  sendMessage(): void {
    this.errorMessage.set('');

    const userMessage = this.message.trim();

    if (!userMessage || this.isLoading()) {
      return;
    }

    const visibleUserMessage = this.nextVisibleUserMessage ?? userMessage;
    this.nextVisibleUserMessage = null;

    this.chatMessages.update(
      messages => [
        ...messages,
        {
          role: 'user',
          content: visibleUserMessage
        }
      ]
    );

    this.message = '';
    this.isLoading.set(true);

    // Identify replies to the budget-confirmation prompt without changing other flows.
    const isBudgetContinue = /^continue[.!\s]*$/i.test(userMessage);
    const isBudgetDecline = /^(?:no|no thanks|don't continue|do not continue)[.!\s]*$/i.test(userMessage);
    const isChangeBudget = /^(?:change budget|change my budget|update budget|different budget)(?:\s+to)?(?:\s*[₹$]?\s*[\d,]+(?:\.\d{1,2})?)?[.!\s]*$/i.test(userMessage);
    const hasBudgetAmount = /(?:change budget|change my budget|update budget|different budget)\s+(?:to\s+)?[₹$]?\s*[\d,]+(?:\.\d{1,2})?/i.test(userMessage);
    const lastAssistantMessage = [...this.chatMessages()]
      .reverse()
      .find(chatMessage => chatMessage.role === 'assistant');
    const isBudgetPromptVisible = !!lastAssistantMessage &&
      /reply ['"]continue['"] to view the available flights|continue.*despite the budget warning|couldn't find a round-trip flight combination within your budget/i.test(
        lastAssistantMessage.content
      );
    // Plain "change budget" asks for an amount locally. If an amount is
    // included, send the command to the backend to recalculate the fares.
    const isBudgetDeclineReply = isBudgetPromptVisible &&
      (isBudgetDecline || (isChangeBudget && !hasBudgetAmount));

    if (isBudgetDeclineReply) {
      this.chatMessages.update(messages => [
        ...messages,
        {
          role: 'assistant',
          content: isChangeBudget
            ? 'Please enter your new total trip budget (for example, 15000).'
            : 'Okay, I won’t show flights for this budget. You can change your travel dates or enter a new budget whenever you’re ready.'
        }
      ]);
      // This reply is handled locally, so no API request is running.
      this.persistCurrentConversation();
      // Always clear the loading state for both "no" and "change budget".
      this.isLoading.set(false);
      return;
    }

    this.plannerService
      .sendMessage(
        userMessage,
        this.conversationId
      )
      .subscribe({
        next: (response) => {
          // When the user explicitly accepts an over-budget result, keep the
          // earlier warning in chat history but omit it from this new response.
          // The outbound-results message and flight cards are preserved.
          let assistantResponseText = (response.response || '').trim();
          const bookingWasCreated = /booking was created successfully|order was created successfully|booking created successfully/i.test(assistantResponseText) && /order\s*id/i.test(assistantResponseText);
          if (bookingWasCreated) {
            this.bookingCreated = true;
            this.passengerDetailsOpen = false;
            this.reviewTripOpen = false;
          }
          if (response.next_step === 'flight_passenger_details') {
            // The form collects structured fields; don't expose a JSON example in chat.
            assistantResponseText =
              'Please complete the passenger details form to continue with your Duffel test booking.';
            this.passengerDetailsOpen = true;
            this.reviewTripOpen = false;
          }

          if (response.next_step === 'hotel_confirmation') {
            this.passengerDetailsOpen = false;
          }

          if (!assistantResponseText) {
            const fallbackMessages: Record<string, string> = {
              travel_confirmation: 'Are you planning to travel?',
              origin: 'What city are you travelling from?',
              destination: 'Where would you like to travel?',
              dates: 'What dates would you like to travel?',
              budget: 'What is your budget for the trip?',
              weather_confirmation:
                'Would you like to continue with these dates or change your travel dates?',
              outbound_results:
                'I could not load outbound flight details. Please try another date.',
              return_results:
                'I could not load return flight details. Please try another date.',
              trip_review:
                'Your selected flights are ready for review.'
            };
            assistantResponseText = fallbackMessages[response.next_step || ''] ||
              'I could not process that message. Please tell me what you would like to do next.';
          }
          if (isBudgetContinue && response.next_step === 'outbound_results') {
            assistantResponseText = assistantResponseText
              .replace(
                /I couldn't find a round-trip flight combination within your budget[\s\S]*?(?=I found \d+ outbound flight option\(s\))/i,
                ''
              )
              .trim();
          }

          // Once return-flight results arrive, remove earlier weather cards
          // from the chat so the return-flight section stays focused.
          if (response.next_step === 'return_results' || response.next_step === 'trip_review') {
            this.chatMessages.update(messages =>
              messages.map(chatMessage => ({ ...chatMessage, weather: null }))
            );
          }

          this.chatMessages.update(
            messages => {
              // Remove only the previous budget-warning bubble after an explicit
              // "continue" successfully advances to outbound results. Keep the
              // user's messages, weather warnings, and all flight-selection data.
              const visibleMessages =
                isBudgetContinue && response.next_step === 'outbound_results'
                  ? messages.filter(chatMessage =>
                      !(
                        chatMessage.role === 'assistant' &&
                        /couldn't find a round-trip flight combination within your budget/i.test(
                          chatMessage.content
                        )
                      )
                    )
                  : messages;

              return [
                ...visibleMessages,
                {
                  role: 'assistant',
                  content: this.formatAssistantMessage(
                    assistantResponseText
                  ),
                  bookingActions: bookingWasCreated,
                  hotels: response.next_step === 'hotel_search_results' ? response.hotels ?? [] : [],
                weather:
                  response.next_step === 'weather_confirmation' ||
                  response.next_step === 'outbound_results'
                    ? this.getDisplayableWeather(response.weather)
                    : null,
                // Only show flight cards when the backend has moved
                // to an outbound or return flight-results stage.
                flights:
                  response.next_step === 'outbound_results' ||
                  response.next_step === 'return_results'
                    ? response.flights ?? []
                    : [],
                flightDirection: this.getFlightDirection(
                  response.next_step
                ),
                selectedOutboundFlight:
                  response.selected_outbound_flight ?? null,
                selectedReturnFlight:
                  response.selected_return_flight ?? null,
                // Alternative dates belong to weather confirmation only.
                suggestedDates:
                  response.next_step === 'weather_confirmation'
                    ? response.suggested_dates ?? []
                    : []
              }
              ];
            }
          );

          if (response.selected_outbound_flight) {
            this.selectedOutboundFlight =
              response.selected_outbound_flight;
          }

          if (response.selected_return_flight) {
            this.selectedReturnFlight = response.selected_return_flight;
          } else if (response.next_step === 'trip_review' &&
                     this.hasCompleteRoundTrip(this.selectedOutboundFlight)) {
            this.selectedReturnFlight = null;
          }
          if (response.next_step === 'trip_review' && this.selectedOutboundFlight) {
            this.reviewTripOpen = true;
          }

          this.persistCurrentConversation();
          this.isLoading.set(false);

          if (response.next_step === 'dates') {
            this.openCalendar();
          }
        },
        error: (error) => {
          console.error('Planner error:', error);
          this.isLoading.set(false);

          this.errorMessage.set(
            error.error?.detail ||
            'Unable to process your request.'
          );
        }
      });
  }

  openPassengerDetails(): void {
    if (!this.selectedOutboundFlight || this.isLoading()) return;
    if (!this.hasCompleteRoundTrip(this.selectedOutboundFlight) && !this.selectedReturnFlight) {
      this.errorMessage.set('Please select a complete round-trip itinerary first.');
      return;
    }
    this.reviewTripOpen = false;
    // Backend advances trip_review -> flight_passenger_details. The form opens
    // when that response returns, preventing a dead button or premature order.
    this.message = 'confirm booking';
    this.sendMessage();
  }

  getTodayDate(): string {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  sendSuggestedMessage(text: string): void {
    if (this.isLoading()) return;
    this.message = text;
    this.sendMessage();
  }

  closePassengerDetails(): void {
    this.passengerDetailsOpen = false;
  }

  submitPassengerDetails(): void {
    if (this.isLoading()) {
      return;
    }

    const details = this.passengerDetails;
    const required: Array<keyof typeof details> = [
      'given_name', 'family_name', 'title', 'gender',
      'born_on', 'email', 'phone_number'
    ];

    const missing = required.filter(key => !String(details[key] ?? '').trim());
    if (missing.length) {
      this.errorMessage.set('Please complete all passenger details before continuing.');
      return;
    }

    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(details.email.trim())) {
      this.errorMessage.set('Please enter a valid email address.');
      return;
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(details.born_on) ||
        Number.isNaN(new Date(`${details.born_on}T00:00:00`).getTime())) {
      this.errorMessage.set('Please enter a valid date of birth.');
      return;
    }

    this.errorMessage.set('');
    // The backend needs JSON, but the raw payload should never be shown in chat.
    this.nextVisibleUserMessage = 'Passenger details submitted';
    this.message = JSON.stringify({
      given_name: details.given_name.trim(),
      family_name: details.family_name.trim(),
      title: details.title,
      gender: details.gender,
      born_on: details.born_on,
      email: details.email.trim(),
      phone_number: details.phone_number.trim()
    });
    this.sendMessage();
  }

  openCalendar(): void {
    this.calendarOpen = true;
    this.selectedStartDate = '';
    this.selectedEndDate = '';
    this.calendarMonth = new Date();
  }

  closeCalendar(): void {
    this.calendarOpen = false;
  }

  previousMonth(): void {
    this.calendarMonth = new Date(
      this.calendarMonth.getFullYear(),
      this.calendarMonth.getMonth() - 1,
      1
    );
  }

  nextMonth(): void {
    this.calendarMonth = new Date(
      this.calendarMonth.getFullYear(),
      this.calendarMonth.getMonth() + 1,
      1
    );
  }

  getMonthName(month: Date): string {
    return month.toLocaleString('en-US', {
      month: 'long',
      year: 'numeric'
    });
  }

  getSecondMonth(): Date {
    return new Date(
      this.calendarMonth.getFullYear(),
      this.calendarMonth.getMonth() + 1,
      1
    );
  }

  getCalendarDays(month: Date): CalendarDay[] {
    const year = month.getFullYear();
    const monthIndex = month.getMonth();

    const firstDay = new Date(year, monthIndex, 1);
    const lastDay = new Date(year, monthIndex + 1, 0);

    const days: CalendarDay[] = [];
    const firstWeekday = firstDay.getDay();

    for (let i = 0; i < firstWeekday; i++) {
      days.push({
        date: '',
        day: 0,
        currentMonth: false
      });
    }

    for (let day = 1; day <= lastDay.getDate(); day++) {
      const date = new Date(year, monthIndex, day);

      days.push({
        date: this.formatDate(date),
        day,
        currentMonth: true
      });
    }

    return days;
  }

  formatDate(date: Date): string {
    const year = date.getFullYear();

    const month = String(
      date.getMonth() + 1
    ).padStart(2, '0');

    const day = String(
      date.getDate()
    ).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

  selectDate(date: string): void {
    if (!date) {
      return;
    }

    if (!this.selectedStartDate || this.selectedEndDate) {
      this.selectedStartDate = date;
      this.selectedEndDate = '';
      return;
    }

    if (date < this.selectedStartDate) {
      this.selectedStartDate = date;
      return;
    }

    this.selectedEndDate = date;
  }

  isSelected(date: string): boolean {
    return (
      date === this.selectedStartDate ||
      date === this.selectedEndDate
    );
  }

  isInRange(date: string): boolean {
    if (!this.selectedStartDate || !this.selectedEndDate) {
      return false;
    }

    return (
      date > this.selectedStartDate &&
      date < this.selectedEndDate
    );
  }

  updateDates(): void {
    if (
      !this.selectedStartDate ||
      !this.selectedEndDate ||
      this.isLoading()
    ) {
      return;
    }

    this.calendarOpen = false;

    const displayStart = this.formatDisplayDate(
      this.selectedStartDate
    );

    const displayEnd = this.formatDisplayDate(
      this.selectedEndDate
    );

    this.chatMessages.update(
      messages => [
        ...messages,
        {
          role: 'user',
          content: `${displayStart} - ${displayEnd}`
        }
      ]
    );

    this.isLoading.set(true);

    this.plannerService
      .sendMessage(
        'I have selected my travel dates.',
        this.conversationId,
        this.selectedStartDate,
        this.selectedEndDate
      )
      .subscribe({
        next: (response) => {
          // Once return-flight results arrive, remove earlier weather cards
          // from the chat so the return-flight section stays focused.
          if (response.next_step === 'return_results' || response.next_step === 'trip_review') {
            this.chatMessages.update(messages =>
              messages.map(chatMessage => ({ ...chatMessage, weather: null }))
            );
          }

          this.chatMessages.update(
            messages => [
              ...messages,
              {
                role: 'assistant',
                content: this.formatAssistantMessage(
                  response.response
                ),
                weather:
                  response.next_step === 'weather_confirmation' ||
                  response.next_step === 'outbound_results'
                    ? this.getDisplayableWeather(response.weather)
                    : null,
                // Only show flight cards when the backend has moved
                // to an outbound or return flight-results stage.
                flights:
                  response.next_step === 'outbound_results' ||
                  response.next_step === 'return_results'
                    ? response.flights ?? []
                    : [],
                flightDirection: this.getFlightDirection(
                  response.next_step
                ),
                selectedOutboundFlight:
                  response.selected_outbound_flight ?? null,
                selectedReturnFlight:
                  response.selected_return_flight ?? null,
                // Alternative dates belong to weather confirmation only.
                suggestedDates:
                  response.next_step === 'weather_confirmation'
                    ? response.suggested_dates ?? []
                    : []
              }
            ]
          );

          if (response.selected_outbound_flight) {
            this.selectedOutboundFlight =
              response.selected_outbound_flight;
          }

          if (response.selected_return_flight) {
            this.selectedReturnFlight = response.selected_return_flight;
          } else if (response.next_step === 'trip_review' &&
                     this.hasCompleteRoundTrip(this.selectedOutboundFlight)) {
            this.selectedReturnFlight = null;
          }
          if (response.next_step === 'trip_review' && this.selectedOutboundFlight) {
            this.reviewTripOpen = true;
          }

          this.persistCurrentConversation();
          this.isLoading.set(false);

          if (response.next_step === 'dates') {
            this.openCalendar();
          }
        },
        error: (error) => {
          console.error('Date selection error:', error);
          this.isLoading.set(false);

          this.errorMessage.set(
            error.error?.detail ||
            'Unable to save the selected dates.'
          );
        }
      });
  }

  formatDisplayDate(dateString: string): string {
    const date = new Date(`${dateString}T00:00:00`);

    return date.toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  }

  getWeatherDescription(code: number): string {
    if (code === 0) return 'Clear sky';
    if (code === 1) return 'Mainly clear';
    if (code === 2) return 'Partly cloudy';
    if (code === 3) return 'Overcast';
    if ([45, 48].includes(code)) return 'Fog';
    if ([51, 53, 55].includes(code)) return 'Drizzle';
    if ([56, 57].includes(code)) return 'Freezing drizzle';
    if ([61, 63, 65].includes(code)) return 'Rain';
    if ([66, 67].includes(code)) return 'Freezing rain';
    if ([71, 73, 75, 77].includes(code)) return 'Snow';
    if ([80, 81, 82].includes(code)) return 'Rain showers';
    if ([85, 86].includes(code)) return 'Snow showers';
    if (code === 95) return 'Thunderstorm';
    if ([96, 99].includes(code)) return 'Thunderstorm with hail';

    return 'Weather unavailable';
  }

  getWeatherIcon(code: number): string {
    if (code === 0) return '☀️';
    if ([1, 2].includes(code)) return '🌤️';
    if (code === 3) return '☁️';
    if ([45, 48].includes(code)) return '🌫️';
    if ([51, 53, 55, 56, 57].includes(code)) return '🌦️';
    if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return '🌧️';
    if ([71, 73, 75, 77, 85, 86].includes(code)) return '🌨️';
    if ([95, 96, 99].includes(code)) return '⛈️';

    return '🌡️';
  }

  formatWeatherDate(dateString: string): string {
    const date = new Date(`${dateString}T00:00:00`);

    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  }

  toggleSidebar(): void {
    this.sidebarOpen = !this.sidebarOpen;
  }

  logout(): void {
    this.authenticationService.logout();
    this.router.navigate(['/login']);
  }
  openHotelBookings(): void {
    this.showHotelBookingsView();
  }

}