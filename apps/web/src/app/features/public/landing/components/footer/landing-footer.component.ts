import { Component, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { lucideShieldCheck, lucideLinkedin, lucideInstagram, lucideMail, lucidePhone, lucideMapPin } from '@ng-icons/lucide';


@Component({
  selector: 'app-landing-footer',
  standalone: true,
  imports: [NgIconComponent],
  providers: [provideIcons({ lucideShieldCheck, lucideLinkedin, lucideInstagram, lucideMail, lucidePhone, lucideMapPin })],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './landing-footer.component.html',
  styleUrl: './landing-footer.component.scss',
})
export class LandingFooterComponent {
  readonly currentYear = new Date().getFullYear();
}
