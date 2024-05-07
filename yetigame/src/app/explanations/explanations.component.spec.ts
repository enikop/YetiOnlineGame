import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ExplanationsComponent } from './explanations.component';

describe('ExplanationsComponent', () => {
  let component: ExplanationsComponent;
  let fixture: ComponentFixture<ExplanationsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ExplanationsComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(ExplanationsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
