import { Component, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';

@Component({
  selector: 'app-landing-personas',
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './landing-personas.component.html',
  styleUrl: './landing-personas.component.scss',
})
export class LandingPersonasComponent {
  readonly personas = [
    {
      icon: 'solar:user-hand-up-linear',
      title: 'Engenheiro Autônomo',
      subtitle: 'Para quem toca a operação sozinho',
      description: 'Organize sua carteira de clientes, padronize entregas e ganhe velocidade sem depender de ninguém para fechar o mês.',
      badge: 'Mais Popular',
      delay: 'delay-100',
    },
    {
      icon: 'solar:city-linear',
      title: 'Consultoria de Engenharia',
      subtitle: 'Para quem gerencia múltiplos clientes',
      description: 'Monte sua equipe, distribua clientes, controle créditos e acompanhe a produção de cada analista em campo ou no escritório.',
      badge: null,
      delay: 'delay-200',
    },
    {
      icon: 'solar:graph-up-linear',
      title: 'Gestor / Coordenador',
      subtitle: 'Para quem precisa de visibilidade',
      description: 'Acesse dashboards, matrizes de risco e documentação consolidada para tomadas de decisão sem precisar editar linhas de Excel.',
      badge: null,
      delay: 'delay-300',
    },
  ];
}
