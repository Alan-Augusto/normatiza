import { Component, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';

@Component({
  selector: 'app-landing-logos-bar',
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './landing-logos-bar.component.html',
  styleUrl: './landing-logos-bar.component.scss',
})
export class LandingLogosBarComponent {
  readonly logos = [
    { icon: 'solar:buildings-linear', name: 'ENGECORP' },
    { icon: 'solar:shield-check-linear', name: 'SAFETY.INC' },
    { icon: 'solar:factory-linear', name: 'INDUSTEC' },
    { icon: 'solar:settings-linear', name: 'METALURG' },
    { icon: 'solar:bolt-linear', name: 'ELETRORISK' },
  ];
}
