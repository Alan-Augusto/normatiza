import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgIconComponent } from '@ng-icons/core';
import { PresentationI18nService } from '../../services/presentation-i18n.service';

@Component({
  selector: 'app-presentation-cta',
  standalone: true,
  imports: [CommonModule, NgIconComponent],
  templateUrl: './cta.component.html',
  styleUrl: './cta.component.css'
})
export class CtaComponent {
  private i18n = inject(PresentationI18nService);
  t = this.i18n.t;
}
