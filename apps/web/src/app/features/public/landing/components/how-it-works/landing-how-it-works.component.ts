import { Component } from '@angular/core';

@Component({
  selector: 'app-landing-how-it-works',
  standalone: true,
  templateUrl: './landing-how-it-works.component.html',
  styleUrl: './landing-how-it-works.component.scss',
})
export class LandingHowItWorksComponent {
  readonly steps = [
    { number: 1, title: 'Crie sua conta', description: 'Cadastre seus dados profissionais e CREA em 2 minutos.', delay: 'delay-100', isFinal: false },
    { number: 2, title: 'Adicione clientes', description: 'Cadastre as empresas, setores e equipamentos base.', delay: 'delay-200', isFinal: false },
    { number: 3, title: 'Produza análises', description: 'Preencha o fluxo guiado com riscos, cálculos e medidas.', delay: 'delay-300', isFinal: false },
    { number: 4, title: 'Entregue relatórios', description: 'Gere PDFs prontos e encante seus clientes na hora.', delay: 'delay-400', isFinal: true },
  ];
}
