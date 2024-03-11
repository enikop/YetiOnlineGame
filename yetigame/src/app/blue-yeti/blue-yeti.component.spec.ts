import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BlueYetiComponent } from './blue-yeti.component';

describe('BlueYetiComponent', () => {
  let component: BlueYetiComponent;
  let fixture: ComponentFixture<BlueYetiComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BlueYetiComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(BlueYetiComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
