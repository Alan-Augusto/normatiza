import { Injectable, signal, computed } from '@angular/core';

export type Language = 'en' | 'pt';

const TRANSLATIONS = {
  en: {
    hero: {
      badge: 'Corporate Presentation',
      title: 'Engineering & Technology for Industrial Safety',
      subtitle: 'Complete NR-12 compliance management ecosystem.'
    },
    problem: {
      title: 'The Industrial Compliance Chaos',
      cards: [
        'Decentralized documentation in spreadsheets and folders',
        'High legal risk and potential plant shutdowns',
        'Time lost in manual inspections on the factory floor',
        'Lack of real-time visibility for decision makers'
      ]
    },
    solution: {
      title: 'A Paradigm Shift in Machine Safety',
      subtitle: 'We eliminate chaos by unifying multidisciplinary engineering with a proprietary management platform.'
    },
    software: {
      title: 'Proprietary Technology',
      subtitle: 'Built for the factory floor. Designed for management.',
      features: [
        'Offline-first Factory App',
        'Real-time Management Dashboard',
        'Cloud-based Documentation',
        'Automated, high-quality visual reports'
      ]
    },
    trust: {
      title: 'Multidisciplinary Engineering',
      stats: { clients: '200+', experts: '100%', speed: '90%' },
      differentials: [
        'Mechanical, Electrical, Automation & Safety Experts',
        'Up to 90% faster project delivery',
        'National Coverage & International Standards'
      ]
    },
    timeline: {
      title: 'End-to-End Process & Deliverables',
      steps: [
        '1. Machinery Inventory & Assessment',
        '2. Engineering Projects',
        '3. Execution & Adequation',
        '4. Continuous Digital Management'
      ],
      deliverables: [
        'Risk Analysis & Assessments',
        'Electrical Grounding Reports',
        'Instruction Manuals Restoration',
        'Operator & Manager Training Programs'
      ]
    },
    cta: {
      title: 'Next Steps',
      steps: [
        'Technical alignment meeting',
        'Pilot mapping & scope definition',
        'Commercial proposal'
      ],
      contact: 'contato@normatiza.app'
    }
  },
  pt: {
    hero: {
      badge: 'Apresentação Institucional',
      title: 'Engenharia e Tecnologia para Segurança Industrial',
      subtitle: 'Ecossistema completo de gestão e conformidade NR-12.'
    },
    problem: {
      title: 'O Caos da Conformidade Industrial',
      cards: [
        'Documentação descentralizada em planilhas e pastas',
        'Alto risco jurídico e de paralisação de planta',
        'Tempo perdido com inspeções manuais no chão de fábrica',
        'Falta de visibilidade em tempo real para tomada de decisão'
      ]
    },
    solution: {
      title: 'Uma Mudança de Paradigma',
      subtitle: 'Eliminamos o caos unindo engenharia multidisciplinar a uma plataforma proprietária de gestão.'
    },
    software: {
      title: 'Tecnologia Proprietária',
      subtitle: 'Feito para o chão de fábrica. Pensado para a gestão.',
      features: [
        'Aplicativo Offline-first',
        'Dashboard de Gestão em Tempo Real',
        'Documentação 100% na Nuvem',
        'Laudos e relatórios com alto padrão visual'
      ]
    },
    trust: {
      title: 'Engenharia Multidisciplinar',
      stats: { clients: '200+', experts: '100%', speed: '90%' },
      differentials: [
        'Especialistas em Mecânica, Elétrica, Automação e Segurança',
        'Entregas até 90% mais rápidas',
        'Cobertura Nacional e Padrões Internacionais'
      ]
    },
    timeline: {
      title: 'Processo & Entregáveis Completos',
      steps: [
        '1. Inventário e Apreciação de Máquinas',
        '2. Projetos de Engenharia e Automação',
        '3. Execução Física e Adequação',
        '4. Gestão Contínua Digital'
      ],
      deliverables: [
        'Análise e Apreciação de Riscos',
        'Laudos de Aterramento Elétrico',
        'Recomposição de Manuais de Instrução',
        'Treinamentos (Operadores e Gestores)'
      ]
    },
    cta: {
      title: 'Próximos Passos',
      steps: [
        'Reunião de alinhamento técnico',
        'Mapeamento piloto e definição de escopo',
        'Proposta comercial'
      ],
      contact: 'contato@normatiza.app'
    }
  }
};

@Injectable({
  providedIn: 'root'
})
export class PresentationI18nService {
  private _lang = signal<Language>('pt');

  public currentLang = this._lang.asReadonly();

  public t = computed(() => TRANSLATIONS[this._lang()]);

  public toggleLanguage() {
    this._lang.update(l => l === 'en' ? 'pt' : 'en');
  }
}
