import { Component, CUSTOM_ELEMENTS_SCHEMA, ElementRef, ViewChild, afterNextRender, signal } from '@angular/core';

interface Stat {
  target: number;
  isDecimal: boolean;
  suffix: string;
  label: string;
  delay: string;
}

@Component({
  selector: 'app-landing-stats',
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './landing-stats.component.html',
  styleUrl: './landing-stats.component.scss',
})
export class LandingStatsComponent {
  readonly stat1 = signal('0');
  readonly stat2 = signal('0');
  readonly stat3 = signal('0');

  readonly stats: Stat[] = [
    { target: 40, isDecimal: false, suffix: '%', label: 'Mais rápido na produção', delay: '' },
    { target: 85, isDecimal: false, suffix: '%', label: 'Taxa de conclusão de análises', delay: 'delay-100' },
    { target: 4.8, isDecimal: true, suffix: '/5', label: 'Satisfação (CSAT)', delay: 'delay-200' },
  ];

  @ViewChild('statsSection') statsSection!: ElementRef<HTMLElement>;

  constructor() {
    afterNextRender(() => {
      const section = document.querySelector('.stats-section') as HTMLElement;
      if (!section) return;

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              this.animateCounters();
              observer.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.3 }
      );
      observer.observe(section);
    });
  }

  private animateCounters(): void {
    const signals = [this.stat1, this.stat2, this.stat3];
    this.stats.forEach((stat, index) => {
      const duration = 2000;
      const start = performance.now();

      const step = (now: number) => {
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        const value = eased * stat.target;
        signals[index].set(stat.isDecimal ? value.toFixed(1) : Math.round(value).toString());
        if (progress < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }
}
