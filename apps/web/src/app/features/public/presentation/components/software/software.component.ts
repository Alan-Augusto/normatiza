import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { lucideSmartphone, lucideLayoutDashboard, lucideCloud, lucideFileBadge } from '@ng-icons/lucide';
import { PresentationI18nService } from '../../services/presentation-i18n.service';

@Component({
  selector: 'app-presentation-software',
  standalone: true,
  imports: [CommonModule, NgIconComponent],
  providers: [provideIcons({ lucideSmartphone, lucideLayoutDashboard, lucideCloud, lucideFileBadge })],
  templateUrl: './software.component.html',
  styleUrl: './software.component.css'
})
export class SoftwareComponent {
  private i18n = inject(PresentationI18nService);
  t = this.i18n.t;
}
