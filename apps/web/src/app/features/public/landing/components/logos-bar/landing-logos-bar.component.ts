import { Component, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { lucideBuilding, lucideShieldCheck, lucideFactory, lucideSettings, lucideZap } from '@ng-icons/lucide';


@Component({
  selector: 'app-landing-logos-bar',
  standalone: true,
  imports: [NgIconComponent],
  providers: [provideIcons({ lucideBuilding, lucideShieldCheck, lucideFactory, lucideSettings, lucideZap })],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './landing-logos-bar.component.html',
  styleUrl: './landing-logos-bar.component.scss',
})
export class LandingLogosBarComponent {
  readonly logos = [
    { icon: 'lucideBuilding', name: 'ENGECORP' },
    { icon: 'lucideShieldCheck', name: 'SAFETY.INC' },
    { icon: 'lucideFactory', name: 'INDUSTEC' },
    { icon: 'lucideSettings', name: 'METALURG' },
    { icon: 'lucideZap', name: 'ELETRORISK' },
  ];
}
