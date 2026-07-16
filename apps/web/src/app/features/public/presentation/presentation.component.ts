import { Component, HostListener, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PresentationI18nService } from './services/presentation-i18n.service';

import { HeroComponent } from './components/hero/hero.component';
import { ProblemComponent } from './components/problem/problem.component';
import { SolutionComponent } from './components/solution/solution.component';
import { SoftwareComponent } from './components/software/software.component';
import { TimelineComponent } from './components/timeline/timeline.component';
import { TrustComponent } from './components/trust/trust.component';
import { CtaComponent } from './components/cta/cta.component';

@Component({
  selector: 'app-presentation',
  standalone: true,
  imports: [
    CommonModule,
    HeroComponent,
    ProblemComponent,
    SolutionComponent,
    SoftwareComponent,
    TimelineComponent,
    TrustComponent,
    CtaComponent
  ],
  templateUrl: './presentation.component.html',
  styleUrl: './presentation.component.css'
})
export class PresentationComponent {
  public i18n = inject(PresentationI18nService);
  currentSlide = signal(0);
  totalSlides = 7;

  // Slides 2, 3, 4 are Light Mode. We need dark text on them.
  isLightSlide() {
    return [2, 3, 4].includes(this.currentSlide());
  }

  @HostListener('window:keydown', ['$event'])
  handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'ArrowRight' || event.key === ' ') {
      this.nextSlide();
    } else if (event.key === 'ArrowLeft') {
      this.prevSlide();
    }
  }

  nextSlide() {
    if (this.currentSlide() < this.totalSlides - 1) {
      this.currentSlide.update(v => v + 1);
    }
  }

  prevSlide() {
    if (this.currentSlide() > 0) {
      this.currentSlide.update(v => v - 1);
    }
  }

  setSlide(index: number) {
    this.currentSlide.set(index);
  }
}
