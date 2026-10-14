import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MyTrips } from './my-trips';

describe('MyTrips', () => {
  let component: MyTrips;
  let fixture: ComponentFixture<MyTrips>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MyTrips],
    }).compileComponents();

    fixture = TestBed.createComponent(MyTrips);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
