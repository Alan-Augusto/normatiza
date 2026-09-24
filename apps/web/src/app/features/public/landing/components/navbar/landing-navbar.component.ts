import { Component, CUSTOM_ELEMENTS_SCHEMA, HostListener, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ROTAS } from '../../../../../core/routing/rotas';

@Component({
  selector: 'app-landing-navbar',
  standalone: true,
  imports: [RouterLink],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './landing-navbar.component.html',
  styleUrl: './landing-navbar.component.scss',
})
export class LandingNavbarComponent {
  protected readonly rotas = ROTAS;

  readonly isScrolled = signal(false);

  @HostListener('window:scroll')
  onScroll(): void {
    this.isScrolled.set(window.scrollY > 20);
  }
}
