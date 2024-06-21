import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ComparisonTestModalComponent } from './comparison-test-modal.component';

describe('ComparisonTestModalComponent', () => {
  let component: ComparisonTestModalComponent;
  let fixture: ComponentFixture<ComparisonTestModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ComparisonTestModalComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(ComparisonTestModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
