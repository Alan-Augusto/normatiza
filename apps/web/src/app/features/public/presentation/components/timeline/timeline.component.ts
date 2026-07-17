import { Component, inject, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgIconComponent } from '@ng-icons/core';
import { PresentationI18nService } from '../../services/presentation-i18n.service';

@Component({
  selector: 'app-presentation-timeline',
  standalone: true,
  imports: [CommonModule, NgIconComponent],
  templateUrl: './timeline.component.html',
  styleUrl: './timeline.component.css'
})
export class TimelineComponent {
  private i18n = inject(PresentationI18nService);
  t = this.i18n.t;
  progress = 0;

  @HostListener('window:scroll')
  onScroll() {
    const el = document.getElementById('timeline-sec');
    if (el) {
      const rect = el.getBoundingClientRect();
      const windowHeight = window.innerHeight;
      
      // Calculate progress when section is in view
      if (rect.top < windowHeight && rect.bottom > 0) {
        const totalScroll = rect.height;
        const currentScroll = windowHeight - rect.top;
        this.progress = Math.min(100, Math.max(0, (currentScroll / totalScroll) * 100));
      }
    }
  }
}
