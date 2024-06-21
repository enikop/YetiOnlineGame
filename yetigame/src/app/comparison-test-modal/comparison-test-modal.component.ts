import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { get_mathjax_svg } from '../latexhandler';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-comparison-test-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './comparison-test-modal.component.html',
  styleUrl: './comparison-test-modal.component.css'
})
export class ComparisonTestModalComponent {
  @Input()
  isVisible = false;

  @Output()
  closingModal = new EventEmitter<void>();

  @Input()
  isSeries = true;


  sanitizer = inject(DomSanitizer);
  router = inject(Router);

  closeModal(){
    this.closingModal.emit();
  }

  getLatex(formula: string) {
    return get_mathjax_svg( formula );
  }

  transform(svg: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(svg);
  }
}
