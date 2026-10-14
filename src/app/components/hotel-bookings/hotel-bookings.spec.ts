import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HotelBookings } from './hotel-bookings';

describe('HotelBookings', () => {
  let component: HotelBookings;
  let fixture: ComponentFixture<HotelBookings>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HotelBookings],
    }).compileComponents();

    fixture = TestBed.createComponent(HotelBookings);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
