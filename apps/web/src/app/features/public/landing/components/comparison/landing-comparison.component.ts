import { Component, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';

@Component({
  selector: 'app-landing-comparison',
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './landing-comparison.component.html',
  styleUrl: './landing-comparison.component.scss',
})
export class LandingComparisonComponent {
  readonly beforeItems = [
    'Análises fragmentadas em planilhas soltas e desorganizadas',
    'PDFs formatados manualmente no Word (risco de erro)',
    'Equipe operando sem visibilidade central',
    'Sem rastreabilidade e controle documental',
  ];

  readonly afterItems = [
    'Fluxo guiado com salvamento automático na nuvem',
    'PDFs gerados em 1 clique com sua marca e logo',
    'Painel de equipe com atribuição por cliente',
    'Numeração sequencial automática e rastreável',
  ];
}
