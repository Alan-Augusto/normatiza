import { Component, inject, ElementRef, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { lucideSearch, lucidePenTool, lucideWrench, lucideRefreshCw, lucideShieldCheck, lucideZap, lucideBookOpen, lucideGraduationCap } from '@ng-icons/lucide';
import { PresentationI18nService } from '../../services/presentation-i18n.service';

@Component({
  selector: 'app-presentation-timeline',
  standalone: true,
  imports: [CommonModule, NgIconComponent],
  providers: [provideIcons({ lucideSearch, lucidePenTool, lucideWrench, lucideRefreshCw, lucideShieldCheck, lucideZap, lucideBookOpen, lucideGraduationCap })],
  templateUrl: './timeline.component.html',
  styleUrl: './timeline.component.css'
})
export class TimelineComponent implements OnInit, OnDestroy {
  private i18n = inject(PresentationI18nService);
  private el = inject(ElementRef);
  private cdr = inject(ChangeDetectorRef);
  
  t = this.i18n.t;
  isVisible = false;
  private observer: IntersectionObserver | null = null;

  ngOnInit() {
    this.observer = new IntersectionObserver(([entry]) => {
      this.isVisible = entry.isIntersecting;
      this.cdr.detectChanges(); // Força a atualização da tela
    }, { threshold: 0.05 }); // Funciona mesmo se aparecer só 5%

    // Observar depois de um pequeno delay garante que o Angular renderizou a DOM
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
