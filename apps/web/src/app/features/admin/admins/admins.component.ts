import { Component } from '@angular/core';

/**
 * Admins da Plataforma — Contexto 0.
 *
 * Quem administra o produto, não quem administra uma consultoria. Ser admin não
 * é papel de vínculo: é uma dimensão sobreposta ao login que a pessoa já tem, e
 * por isso esta lista mostra gente que também vive dentro de alguma conta.
 *
 * Esqueleto: a Fase 5 do plano de gestão de equipe preenche.
 */
@Component({
  selector: 'app-admin-admins',
  standalone: true,
  imports: [],
  templateUrl: './admins.component.html',
  styleUrl: './admins.component.css',
})
export class AdminsComponent {}
