import { Component, afterNextRender } from '@angular/core';

import { LandingNavbarComponent } from './components/navbar/landing-navbar.component';
import { LandingHeroComponent } from './components/hero/landing-hero.component';
import { LandingLogosBarComponent } from './components/logos-bar/landing-logos-bar.component';
import { LandingProblemComponent } from './components/problem/landing-problem.component';
import { LandingSolutionComponent } from './components/solution/landing-solution.component';
import { LandingFeaturesComponent } from './components/features/landing-features.component';
import { LandingHowItWorksComponent } from './components/how-it-works/landing-how-it-works.component';
import { LandingTestimonialsComponent } from './components/testimonials/landing-testimonials.component';
import { LandingComparisonComponent } from './components/comparison/landing-comparison.component';
import { LandingPersonasComponent } from './components/personas/landing-personas.component';
import { LandingStatsComponent } from './components/stats/landing-stats.component';
import { LandingFaqComponent } from './components/faq/landing-faq.component';
import { LandingCtaComponent } from './components/cta/landing-cta.component';
import { LandingFooterComponent } from './components/footer/landing-footer.component';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [
    LandingNavbarComponent,
    LandingHeroComponent,
    LandingLogosBarComponent,
    LandingProblemComponent,
    LandingSolutionComponent,
    LandingFeaturesComponent,
    LandingHowItWorksComponent,
    LandingTestimonialsComponent,
    LandingComparisonComponent,
    LandingPersonasComponent,
    LandingStatsComponent,
    LandingFaqComponent,
    LandingCtaComponent,
    LandingFooterComponent,
  ],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.css',
})
export class LandingComponent {
  constructor() {
    afterNextRender(() => {
      this.initScrollReveal();
      this.initFeatureGroups();
    });
  }

  private initScrollReveal(): void {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('active');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1 }
    );

    document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
  }

  private initFeatureGroups(): void {
    // On desktop, CSS :hover handles the looping animations.
    // On touch devices (no fine pointer), use IntersectionObserver to toggle .feature-active.
    const isTouchDevice = window.matchMedia('(hover: none)').matches;
    if (!isTouchDevice) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          entry.target.classList.toggle('feature-active', entry.isIntersecting);
        });
      },
      { threshold: 0.3 }
    );

    document.querySelectorAll('.feature-group').forEach(el => observer.observe(el));
  }
}
