import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PresentationI18nService } from '../../services/presentation-i18n.service';

@Component({
  selector: 'app-presentation-trust',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './trust.component.html',
  styleUrl: './trust.component.css'
})
export class TrustComponent {
  private i18n = inject(PresentationI18nService);
  t = this.i18n.t;
}
