import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PresentationI18nService } from '../../services/presentation-i18n.service';

@Component({
  selector: 'app-presentation-header',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './header.component.html',
  styleUrl: './header.component.css'
})
export class HeaderComponent {
  private i18n = inject(PresentationI18nService);
  
  lang = this.i18n.currentLang;

  toggleLang() {
    this.i18n.toggleLanguage();
  }
}
