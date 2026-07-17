import { Component, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { lucideListChecks, lucideCheck, lucidePrinter, lucideShieldCheck, lucideImage, lucideFileText, lucideUsers, lucideTrendingUp, lucideClock, lucidePieChart } from '@ng-icons/lucide';


@Component({
  selector: 'app-landing-features',
  standalone: true,
  imports: [NgIconComponent],
  providers: [provideIcons({ lucideListChecks, lucideCheck, lucidePrinter, lucideShieldCheck, lucideImage, lucideFileText, lucideUsers, lucideTrendingUp, lucideClock, lucidePieChart })],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './landing-features.component.html',
  styleUrl: './landing-features.component.scss',
})
export class LandingFeaturesComponent {}
