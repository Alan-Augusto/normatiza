import { Component, inject, ElementRef, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { lucideCalendar, lucideMap, lucideFileSignature, lucideMail, lucideMessageCircle } from '@ng-icons/lucide';
import { PresentationI18nService } from '../../services/presentation-i18n.service';

@Component({
  selector: 'app-presentation-cta',
  standalone: true,
  imports: [CommonModule, NgIconComponent],
  providers: [provideIcons({ lucideCalendar, lucideMap, lucideFileSignature, lucideMail, lucideMessageCircle })],
  templateUrl: './cta.component.html',
  styleUrl: './cta.component.css'
})
export class CtaComponent implements OnInit, OnDestroy {
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
