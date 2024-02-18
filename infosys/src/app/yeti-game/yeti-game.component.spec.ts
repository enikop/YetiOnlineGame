import { ComponentFixture, TestBed } from '@angular/core/testing';

import { YetiGameComponent } from './yeti-game.component';

describe('YetiGameComponent', () => {
  let component: YetiGameComponent;
  let fixture: ComponentFixture<YetiGameComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [YetiGameComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(YetiGameComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
