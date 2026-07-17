import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PresentationI18nService } from '../../services/presentation-i18n.service';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { lucideCircleDollarSign, lucideOctagonAlert, lucideHeartCrack } from '@ng-icons/lucide';

@Component({
  selector: 'app-presentation-cost',
  standalone: true,
  imports: [CommonModule, NgIconComponent],
  providers: [provideIcons({ lucideCircleDollarSign, lucideOctagonAlert, lucideHeartCrack })],
  templateUrl: './cost.component.html',
  styleUrl: './cost.component.css'
})
export class CostComponent {
  private i18n = inject(PresentationI18nService);
  t = this.i18n.t;
}
