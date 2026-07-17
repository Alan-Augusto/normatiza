import { Component, inject, ElementRef, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PresentationI18nService } from '../../services/presentation-i18n.service';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { lucideMapPin, lucideUsers, lucideCode, lucideAward } from '@ng-icons/lucide';

@Component({
  selector: 'app-presentation-about-us',
  standalone: true,
  imports: [CommonModule, NgIconComponent],
  providers: [provideIcons({ lucideMapPin, lucideUsers, lucideCode, lucideAward })],
  templateUrl: './about-us.component.html',
  styleUrl: './about-us.component.css'
})
export class AboutUsComponent implements OnInit, OnDestroy {
  private i18n = inject(PresentationI18nService);
  private el = inject(ElementRef);
  private cdr = inject(ChangeDetectorRef);

  t = this.i18n.t;
  isVisible = false;
  private observer: IntersectionObserver | null = null;

  ngOnInit() {
    this.observer = new IntersectionObserver(([entry]) => {
      this.isVisible = entry.isIntersecting;
      this.cdr.detectChanges();
    }, { threshold: 0.1 });

    setTimeout(() => {
      if (this.el.nativeElement) {
        this.observer?.observe(this.el.nativeElement);
      }
    }, 50);
  }

  ngOnDestroy() {
    this.observer?.disconnect();
  }
}
