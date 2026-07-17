import { ThemeService } from '../../../shared/services/theme.service';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { lucideMoon, lucideSun } from '@ng-icons/lucide';
import { Component, HostListener, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PresentationI18nService } from './services/presentation-i18n.service';

import { HeroComponent } from './components/hero/hero.component';
import { MissionValuesComponent } from './components/mission-values/mission-values.component';
import { ProblemComponent } from './components/problem/problem.component';
import { CostComponent } from './components/cost/cost.component';
import { SolutionComponent } from './components/solution/solution.component';
import { SoftwareComponent } from './components/software/software.component';
import { ServicesComponent } from './components/services/services.component';
import { TimelineComponent } from './components/timeline/timeline.component';
import { SocialProofComponent } from './components/social-proof/social-proof.component';
import { AboutUsComponent } from './components/about-us/about-us.component';
import { CtaComponent } from './components/cta/cta.component';

@Component({
  selector: 'app-presentation',
  standalone: true,
  providers: [provideIcons({ lucideMoon, lucideSun })],
  imports: [
    CommonModule,
    NgIconComponent,
    HeroComponent,
    MissionValuesComponent,
    ProblemComponent,
    CostComponent,
    SolutionComponent,
    SoftwareComponent,
    ServicesComponent,
    TimelineComponent,
    SocialProofComponent,
    AboutUsComponent,
    CtaComponent
  ],
  templateUrl: './presentation.component.html',
  styleUrl: './presentation.component.css'
})
export class PresentationComponent {
  public i18n = inject(PresentationI18nService);
  public themeService = inject(ThemeService);
  currentSlide = signal(0);
  totalSlides = 11;
  isFinalState = signal(false);

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
    } else if (this.currentSlide() === this.totalSlides - 1) {
      this.isFinalState.set(true);
    }
  }

  prevSlide() {
    if (this.isFinalState()) {
      this.isFinalState.set(false);
    } else if (this.currentSlide() > 0) {
      this.currentSlide.update(v => v - 1);
    }
  }

  setSlide(index: number) {
    this.currentSlide.set(index);
    this.isFinalState.set(false);
  }
}
