import { Component, inject } from '@angular/core';
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
export class AboutUsComponent {
  private i18n = inject(PresentationI18nService);
  t = this.i18n.t;
}
