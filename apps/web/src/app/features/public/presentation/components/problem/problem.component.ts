import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgIconComponent } from '@ng-icons/core';
import { PresentationI18nService } from '../../services/presentation-i18n.service';

@Component({
  selector: 'app-presentation-problem',
  standalone: true,
  imports: [CommonModule, NgIconComponent],
  templateUrl: './problem.component.html',
  styleUrl: './problem.component.css'
})
export class ProblemComponent {
  private i18n = inject(PresentationI18nService);
  t = this.i18n.t;
}
