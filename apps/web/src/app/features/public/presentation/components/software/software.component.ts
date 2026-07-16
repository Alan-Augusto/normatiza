import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PresentationI18nService } from '../../services/presentation-i18n.service';

@Component({
  selector: 'app-presentation-software',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './software.component.html',
  styleUrl: './software.component.css'
})
export class SoftwareComponent {
  private i18n = inject(PresentationI18nService);
  t = this.i18n.t;
}
