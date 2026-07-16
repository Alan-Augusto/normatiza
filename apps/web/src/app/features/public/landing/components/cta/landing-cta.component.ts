import { Component, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';

@Component({
  selector: 'app-landing-cta',
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './landing-cta.component.html',
  styleUrl: './landing-cta.component.scss',
})
export class LandingCtaComponent {}
