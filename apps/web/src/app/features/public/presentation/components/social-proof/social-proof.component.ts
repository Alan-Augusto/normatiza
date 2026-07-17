import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PresentationI18nService } from '../../services/presentation-i18n.service';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { lucideQuote, lucideUsers, lucideZap, lucideGlobe } from '@ng-icons/lucide';

@Component({
  selector: 'app-presentation-social-proof',
  standalone: true,
  imports: [CommonModule, NgIconComponent],
  providers: [provideIcons({ lucideQuote, lucideUsers, lucideZap, lucideGlobe })],
  templateUrl: './social-proof.component.html',
  styleUrl: './social-proof.component.css'
})
export class SocialProofComponent {
  private i18n = inject(PresentationI18nService);
  t = this.i18n.t;
}
