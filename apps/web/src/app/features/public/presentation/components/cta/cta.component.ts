import { Component, inject } from '@angular/core';
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
export class CtaComponent {
  private i18n = inject(PresentationI18nService);
  t = this.i18n.t;
}
