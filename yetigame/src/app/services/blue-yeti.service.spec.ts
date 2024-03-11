import { TestBed } from '@angular/core/testing';

import { BlueYetiService } from './blue-yeti.service';

describe('BlueYetiServiceService', () => {
  let service: BlueYetiService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(BlueYetiService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
