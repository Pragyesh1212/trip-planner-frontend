import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FlightBookings } from './flight-bookings';

describe('FlightBookings', () => {
  let component: FlightBookings;
  let fixture: ComponentFixture<FlightBookings>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FlightBookings],
    }).compileComponents();

    fixture = TestBed.createComponent(FlightBookings);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
