import { Component, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';

@Component({
  selector: 'app-landing-testimonials',
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './landing-testimonials.component.html',
  styleUrl: './landing-testimonials.component.scss',
})
export class LandingTestimonialsComponent {
  readonly testimonials = [
    {
      quote: '"A padronização dos relatórios trouxe um ganho exponencial de faturamento e permitiu absorver novos clientes sem estresse."',
      name: 'Josué Conchi',
      role: 'Eng. de Produção Mecânica',
      initials: 'JC',
      featured: false,
      delay: 'delay-100',
    },
    {
      quote: '"Consigo fazer muito mais em menos tempo. Levanto os dados direto do chão de fábrica e a plataforma faz o resto de forma impecável."',
      name: 'Fernando Conci',
      role: 'Técnico SST',
      initials: 'FC',
      featured: true,
      delay: 'delay-200',
    },
    {
      quote: '"Uma verdadeira mão na roda para levantar dados e gerar relatórios. O tempo que economizo compensa qualquer investimento."',
      name: 'Fabiano de Souza',
      role: 'Técnico em Mecânica',
      initials: 'FS',
      featured: false,
      delay: 'delay-300',
    },
  ];
}
