import { CommonModule } from '@angular/common';
import { Component, Input, inject } from '@angular/core';
import { get_mathjax_svg } from '../latexhandler';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Component({
  selector: 'app-explanations',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './explanations.component.html',
  styleUrl: './explanations.component.css'
})
export class ExplanationsComponent {
  @Input()
  type: string = '';
  @Input()
  integral:boolean = false;

  sanitizer = inject(DomSanitizer);

  getLatex(formula: string) {
    return get_mathjax_svg( formula );
  }

  transform(svg: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(svg);
  }
}
