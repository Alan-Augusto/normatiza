import { Component, signal } from '@angular/core';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { lucidePlusCircle } from '@ng-icons/lucide';


interface FaqItem {
  question: string;
  answer: string;
}

@Component({
  selector: 'app-landing-faq',
  standalone: true,
  imports: [NgIconComponent],
  providers: [provideIcons({ lucidePlusCircle })],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './landing-faq.component.html',
  styleUrl: './landing-faq.component.scss',
})
export class LandingFaqComponent {
  readonly openIndex = signal<number | null>(null);

  readonly items: FaqItem[] = [
    {
      question: 'Quanto custa a Normatiza?',
      answer: 'Trabalhamos com um modelo de créditos flexível. Cada análise concluída consome 1 crédito. Estudos iniciais, laudos e documentos básicos não consomem crédito. Comece com nosso trial gratuito para entender o valor na prática.',
    },
    {
      question: 'Preciso migrar meus dados antigos para começar?',
      answer: 'Não é obrigatório. Você pode cadastrar e começar projetos de novos clientes diretamente na plataforma. Estamos desenvolvendo uma funcionalidade simplificada de importação para dados históricos futuros.',
    },
    {
      question: 'Minha equipe consegue acessar simultaneamente?',
      answer: 'Sim. Você pode convidar analistas e gestores com perfis de permissão separados. Cada membro da equipe acessa apenas os dados dos clientes que foram atribuídos a ele, garantindo segurança e organização.',
    },
    {
      question: 'E se a norma NR-12 mudar ou for atualizada?',
      answer: 'Sendo uma plataforma Cloud (SaaS), o catálogo de normas e diretrizes é atualizado centralmente pelo nosso time técnico. Você sempre terá acesso à versão mais recente sem precisar baixar ou reinstalar nada.',
    },
  ];

  toggle(index: number): void {
    this.openIndex.update(current => current === index ? null : index);
  }
}
