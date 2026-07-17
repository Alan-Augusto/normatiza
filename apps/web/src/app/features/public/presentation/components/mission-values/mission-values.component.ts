import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { lucideShield, lucideAward, lucideTarget, lucideEye, lucideLightbulb } from '@ng-icons/lucide';
import { PresentationI18nService } from '../../services/presentation-i18n.service';

@Component({
  selector: 'app-presentation-mission-values',
  standalone: true,
  imports: [CommonModule, NgIconComponent],
  providers: [provideIcons({ lucideShield, lucideAward, lucideTarget, lucideEye, lucideLightbulb })],
  templateUrl: './mission-values.component.html',
  styleUrl: './mission-values.component.css'
})
export class MissionValuesComponent {
  private i18n = inject(PresentationI18nService);
  t = this.i18n.t;
}
