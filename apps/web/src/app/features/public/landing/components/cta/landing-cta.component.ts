import { Component, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { lucideArrowRight } from '@ng-icons/lucide';


@Component({
  selector: 'app-landing-cta',
  standalone: true,
  imports: [NgIconComponent],
  providers: [provideIcons({ lucideArrowRight })],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './landing-cta.component.html',
  styleUrl: './landing-cta.component.scss',
})
export class LandingCtaComponent {}
