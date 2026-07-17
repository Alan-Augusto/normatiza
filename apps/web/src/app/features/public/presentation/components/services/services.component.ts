import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PresentationI18nService } from '../../services/presentation-i18n.service';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { lucideShieldCheck, lucideFileCheck, lucidePenTool, lucideZap, lucideBookOpen, lucideClipboardList, lucideMessageSquare, lucideGraduationCap } from '@ng-icons/lucide';

@Component({
  selector: 'app-presentation-services',
  standalone: true,
  imports: [CommonModule, NgIconComponent],
  providers: [provideIcons({ lucideShieldCheck, lucideFileCheck, lucidePenTool, lucideZap, lucideBookOpen, lucideClipboardList, lucideMessageSquare, lucideGraduationCap })],
  templateUrl: './services.component.html',
  styleUrl: './services.component.css'
})
export class ServicesComponent {
  private i18n = inject(PresentationI18nService);
  t = this.i18n.t;
}
