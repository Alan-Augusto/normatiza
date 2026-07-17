import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { lucideFiles, lucideShieldAlert, lucideClock, lucideBarChart3 } from '@ng-icons/lucide';
import { PresentationI18nService } from '../../services/presentation-i18n.service';

@Component({
  selector: 'app-presentation-problem',
  standalone: true,
  imports: [CommonModule, NgIconComponent],
  providers: [provideIcons({ lucideFiles, lucideShieldAlert, lucideClock, lucideBarChart3 })],
  templateUrl: './problem.component.html',
  styleUrl: './problem.component.css'
})
export class ProblemComponent {
  private i18n = inject(PresentationI18nService);
  t = this.i18n.t;
}
