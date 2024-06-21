import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { DRAW_TIME, PAIR_TIME } from '../../../models';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { get_mathjax_svg } from '../latexhandler';

@Component({
  selector: 'app-instructions',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './instructions.component.html',
  styleUrl: './instructions.component.css'
})
export class InstructionsComponent {
  pairingDuration = PAIR_TIME;
  drawingDuration = DRAW_TIME;

  sanitizer = inject(DomSanitizer);
  router = inject(Router);

  getLatex(formula: string) {
    return get_mathjax_svg( formula );
  }

  transform(svg: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(svg);
  }




}
