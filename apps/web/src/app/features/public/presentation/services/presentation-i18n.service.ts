import { Injectable, signal, computed } from '@angular/core';

export type Language = 'en' | 'pt';

const TRANSLATIONS = {
  en: {
    hero: {
      badge: 'Corporate Presentation',
      titleLine1: 'Your plant 100%',
      titleLine2: 'NR-12 compliant',
      subtitle: 'Multidisciplinary engineering + proprietary technology to ensure industrial compliance.'
    },
    missionValues: {
      title: 'Our Purpose',
      missionTitle: 'Mission',
      missionText: 'To be the reference in intelligent NR-12 management, transforming legal compliance into a competitive advantage with innovation, engineering, and a commitment to people\'s safety.',
      valuesTitle: 'Values',
      values: [
        { text: 'Safety as a value', icon: 'lucideShield' },
        { text: 'Technical excellence', icon: 'lucideAward' },
        { text: 'Commitment to results', icon: 'lucideTarget' },
        { text: 'Ethics and transparency', icon: 'lucideEye' },
        { text: 'Continuous innovation', icon: 'lucideLightbulb' }
      ]
    },
    problem: {
      title: 'The Current Industrial Scenario',
      cards: [
        { text: 'Lost and scattered documentation, hindering access and audits.', icon: 'lucideFiles' },
        { text: 'High legal risk and potential plant shutdowns from non-compliance', icon: 'lucideShieldAlert' },
        { text: 'Professionals spend up to 70% of their time on bureaucracy and document organization.', icon: 'lucideClock' },
        { text: 'Lack of tools for management to identify non-conformities, avoiding problems in audits and enforcement actions.', icon: 'lucideBarChart3' }
      ]
    },
    cost: {
      title: 'The Cost of Non-Compliance',
      tagline: 'Compliance is not a cost. It\'s protection.',
      cards: [
        { title: 'Financial Risk', text: 'Fines, shutdowns & labor lawsuits that can cripple operations', icon: 'lucideCircleDollarSign' },
        { title: 'Operational Risk', text: 'Unplanned plant shutdowns and severe productivity loss', icon: 'lucideOctagonAlert' },
        { title: 'Human Risk', text: 'Preventable workplace accidents that affect lives and families', icon: 'lucideHeartCrack' }
      ]
    },
    solution: {
      title: 'A Paradigm Shift',
      subtitle: 'We simplify management by combining multidisciplinary engineering with a proprietary platform for machines and equipment.',
      imgAlt: 'Normatiza Platform',
      animation: {
        syncing: 'Syncing...',
        generated: 'Report Generated',
        report: 'NR-12 Report',
        inventory: 'Inventory',
        assessment: 'Risk Assessment'
      },
      pillars: [
        { title: 'Engineering', text: 'Mechanical, electrical, automation & safety team', icon: 'lucideWrench' },
        { title: 'Technology', text: 'Proprietary NR-12 management platform', icon: 'lucideMonitor' },
        { title: 'Compliance', text: 'Complete and traceable documentation', icon: 'lucideShieldCheck' }
      ]
    },
    software: {
      title: 'Proprietary Technology',
      subtitle: 'Built for the factory floor. Designed for management.',
      features: [
        { text: 'Factory floor data collection with software for offline use without data consumption', icon: 'lucideSmartphone' },
        { text: '360° compliance visibility — track the status of every machine', icon: 'lucideLayoutDashboard' },
        { text: 'Easy-to-view reports and dashboards with all company documentation centralized and accessible', icon: 'lucideCloud' },
        { text: 'Reports that meet legal requirements, generated automatically with quality and standardized!', icon: 'lucideFileBadge' }
      ]
    },
    services: {
      title: 'Complete NR-12 Solutions',
      subtitle: 'Everything your company needs in a single partner.',
      items: [
        { title: 'Risk Analysis & Assessment', text: 'Detailed technical evaluation of each machine', icon: 'lucideShieldCheck' },
        { title: 'Conformity Reports', text: 'Complete legal documentation', icon: 'lucideFileCheck' },
        { title: 'Adequation Projects', text: 'Mechanical, electrical & automation engineering', icon: 'lucidePenTool' },
        { title: 'Grounding Reports', text: 'Electrical measurements and certifications', icon: 'lucideZap' },
        { title: 'Instruction Manuals', text: 'Creation and restoration of manuals', icon: 'lucideBookOpen' },
        { title: 'Machinery Inventory', text: 'Complete cataloging of the industrial park', icon: 'lucideClipboardList' },
        { title: 'NR-12 Consulting', text: 'Continuous guidance and support', icon: 'lucideMessageSquare' },
        { title: 'Training Programs', text: 'Operators, supervisors & managers', icon: 'lucideGraduationCap' }
      ]
    },
    timeline: {
      title: 'How We Work',
      processHeader: 'The Process',
      deliverablesHeader: 'Our Solutions',
      steps: [
        { text: 'Machinery Inventory & Assessment', icon: 'lucideSearch' },
        { text: 'Engineering & Automation Projects', icon: 'lucidePenTool' },
        { text: 'Monitoring of physical execution and adequation', icon: 'lucideWrench' },
        { text: 'Continuous Digital Management', icon: 'lucideRefreshCw' }
      ],
      deliverables: [
        { text: 'Risk Analysis & Assessments', icon: 'lucideShieldCheck' },
        { text: 'Electrical Grounding Reports', icon: 'lucideZap' },
        { text: 'Instruction Manuals Restoration', icon: 'lucideBookOpen' },
        { text: 'Operator & Manager Training Programs', icon: 'lucideGraduationCap' }
      ]
    },
    socialProof: {
      title: 'Trusted by Industry Leaders',
      stats: {
        clients: { value: '200+', label: 'Corporate Clients' },
        team: { value: '100%', label: 'Multidisciplinary Team' },
        speed: { value: '90%', label: 'Faster with Software' }
      },
      testimonialsTitle: 'What Our Clients Say',
      testimonials: [
        {
          quote: 'After implementing Normatiza\'s Software in our procedures, I had an exponential gain in revenue and new clients. I can deliver projects well ahead of schedule with impeccable quality.',
          name: 'Josué Conchi',
          role: 'Mechanical Production Engineer'
        },
        {
          quote: 'The convenience that the Normatiza app offers on the factory floor is unmatched. Today we can gather information on-site and adjust everything without internet. For us safety technicians, doing more in less time is excellent.',
          name: 'Fernando Conci',
          role: 'Occupational Health & Safety Technician'
        },
        {
          quote: 'The app is incredibly useful for gathering data, photos and operator information on the factory floor. On the computer it\'s even better — very practical to generate reports, analyses, and track projects.',
          name: 'Fabiano de Souza',
          role: 'Mechanical Technician'
        }
      ]
    },
    aboutUs: {
      title: 'Who is Normatiza',
      subtitle: 'A company born from the need for specialized NR-12 services, combining engineering expertise with proprietary technology.',
      highlights: [
        { title: 'National and International', text: 'Consulting clients in legislation and projects', icon: 'lucideMapPin' },
        { title: 'Specialized Team', text: 'Engineers and technicians in mechanics, electrical, automation & safety', icon: 'lucideUsers' },
        { title: 'Proprietary Technology', text: 'In-house developed NR-12 management software', icon: 'lucideCode' },
        { title: '100% NR-12 Focus', text: 'Dedicated exclusively to machine safety since founding', icon: 'lucideAward' }
      ]
    },
    cta: {
      title: 'Next Steps',
      tagline: 'The sooner the compliance, the lower the risk.',
      steps: [
        { text: 'Technical alignment meeting', icon: 'lucideCalendar' },
        { text: 'Pilot mapping & scope definition', icon: 'lucideMap' },
        { text: 'Commercial proposal', icon: 'lucideFileSignature' }
      ],
      contact: 'contato@normatiza.app',
      whatsapp: '(49) 9 9900-3954'
    }
  },
  pt: {
    hero: {
      badge: 'Apresentação Institucional',
      titleLine1: 'Sua planta 100%',
      titleLine2: 'conforme à NR-12',
      subtitle: 'Engenharia multidisciplinar + tecnologia proprietária para garantir a conformidade industrial.'
    },
    missionValues: {
      title: 'Nosso Propósito',
      missionTitle: 'Missão',
      missionText: 'Ser a referência em gestão inteligente da NR-12, transformando a conformidade legal em um diferencial competitivo, com inovação, engenharia e compromisso com a segurança das pessoas.',
      valuesTitle: 'Valores',
      values: [
        { text: 'Segurança como valor', icon: 'lucideShield' },
        { text: 'Excelência técnica', icon: 'lucideAward' },
        { text: 'Compromisso com os resultados', icon: 'lucideTarget' },
        { text: 'Ética e transparência', icon: 'lucideEye' },
        { text: 'Inovação contínua', icon: 'lucideLightbulb' }
      ]
    },
    problem: {
      title: 'O cenário industrial atual',
      cards: [
        { text: 'Documentação perdida e pulverizada dificultando acesso e auditorias.', icon: 'lucideFiles' },
        { text: 'Alto risco jurídico e de paralisação de planta por não conformidade', icon: 'lucideShieldAlert' },
        { text: 'Profissionais gastam até 70% do tempo com burocracia e organização de documentos.', icon: 'lucideClock' },
        { text: 'Falta de ferramentas para a gestão identificar não conformidades, evitando problemas em auditorias e ações de fiscalização.', icon: 'lucideBarChart3' }
      ]
    },
    cost: {
      title: 'O Preço da Não-Conformidade',
      tagline: 'A conformidade não é custo. É proteção.',
      cards: [
        { title: 'Risco Financeiro', text: 'Multas, interdições e processos trabalhistas que podem paralisar operações', icon: 'lucideCircleDollarSign' },
        { title: 'Risco Operacional', text: 'Paradas de planta não planejadas e perda severa de produtividade', icon: 'lucideOctagonAlert' },
        { title: 'Risco Humano', text: 'Acidentes de trabalho evitáveis que afetam vidas e famílias', icon: 'lucideHeartCrack' }
      ]
    },
    solution: {
      title: 'Uma Mudança de Paradigma',
      subtitle: 'Simplificamos a gestão ao unir engenharia multidisciplinar a uma plataforma proprietária para máquinas e equipamentos.',
      imgAlt: 'Plataforma Normatiza',
      animation: {
        syncing: 'Sincronizando...',
        generated: 'Laudo Gerado',
        report: 'Laudo NR-12',
        inventory: 'Inventário',
        assessment: 'Apreciação'
      },
      pillars: [
        { title: 'Engenharia', text: 'Equipe mecânica, elétrica, automação e segurança', icon: 'lucideWrench' },
        { title: 'Tecnologia', text: 'Plataforma proprietária de gestão NR-12', icon: 'lucideMonitor' },
        { title: 'Conformidade', text: 'Documentação completa e rastreável', icon: 'lucideShieldCheck' }
      ]
    },
    software: {
      title: 'Tecnologia Proprietária',
      subtitle: 'Feito para o chão de fábrica. Pensado para a gestão.',
      features: [
        { text: 'Coleta em chão de fábrica com software para uso offline sem consumo de dados', icon: 'lucideSmartphone' },
        { text: 'Visão 360° da conformidade — acompanhe o status de todas as máquinas', icon: 'lucideLayoutDashboard' },
        { text: 'Relatórios e dashboards de fácil visualização com toda a documentação da empresa centralizada e acessível', icon: 'lucideCloud' },
        { text: 'Relatórios que atendem as premissas legais, gerados automaticamente com qualidade e normatizado!', icon: 'lucideFileBadge' }
      ]
    },
    services: {
      title: 'Soluções Completas para NR-12',
      subtitle: 'Tudo que sua empresa precisa em um único parceiro.',
      items: [
        { title: 'Análise e Apreciação de Riscos', text: 'Avaliação técnica detalhada de cada máquina', icon: 'lucideShieldCheck' },
        { title: 'Laudos de Conformidade', text: 'Documentação legal completa', icon: 'lucideFileCheck' },
        { title: 'Projetos de Adequação', text: 'Engenharia mecânica, elétrica e automação', icon: 'lucidePenTool' },
        { title: 'Laudos de Aterramento', text: 'Medições e certificações elétricas', icon: 'lucideZap' },
        { title: 'Manuais de Instrução', text: 'Criação e recomposição de manuais', icon: 'lucideBookOpen' },
        { title: 'Inventário de Máquinas', text: 'Catalogação completa do parque fabril', icon: 'lucideClipboardList' },
        { title: 'Consultoria NR-12', text: 'Acompanhamento e orientação contínua', icon: 'lucideMessageSquare' },
        { title: 'Treinamentos e Capacitações', text: 'Operadores, supervisores e gestores', icon: 'lucideGraduationCap' }
      ]
    },
    timeline: {
      title: 'Como Trabalhamos',
      processHeader: 'O Processo',
      deliverablesHeader: 'Nossas Soluções',
      steps: [
        { text: 'Inventário e Apreciação de Máquinas', icon: 'lucideSearch' },
        { text: 'Projetos de Engenharia e Automação', icon: 'lucidePenTool' },
        { text: 'Acompanhamento de execução física e adequação', icon: 'lucideWrench' },
        { text: 'Gestão Contínua Digital', icon: 'lucideRefreshCw' }
      ],
      deliverables: [
        { text: 'Análise e Apreciação de Riscos', icon: 'lucideShieldCheck' },
        { text: 'Laudos de Aterramento Elétrico', icon: 'lucideZap' },
        { text: 'Recomposição de Manuais de Instrução', icon: 'lucideBookOpen' },
        { text: 'Treinamentos (Operadores e Gestores)', icon: 'lucideGraduationCap' }
      ]
    },
    socialProof: {
      title: 'A Confiança da Indústria',
      stats: {
        clients: { value: '200+', label: 'Clientes Corporativos' },
        team: { value: '100%', label: 'Time Multidisciplinar' },
        speed: { value: '90%', label: 'Mais rápido com Software' }
      },
      testimonialsTitle: 'O que Nossos Clientes Dizem',
      testimonials: [
        {
          quote: 'Após a implementação do Software da Normatiza nos nossos procedimentos eu tive um ganho exponencial de faturamento e de novos clientes. Consigo entregar os trabalhos muito antes do tempo e com uma qualidade impecável.',
          name: 'Josué Conchi',
          role: 'Engenheiro de Produção Mecânica'
        },
        {
          quote: 'A praticidade que o aplicativo da Normatiza oferece no chão de fábrica é diferenciada. Hoje temos a liberdade de pegar as informações em chão de fábrica e ajustar tudo sem internet. Para nós técnicos de SST é excelente fazer mais em menos tempo.',
          name: 'Fernando Conci',
          role: 'Técnico em Segurança e Saúde do Trabalho'
        },
        {
          quote: 'O aplicativo é uma mão na roda para quando se está levantando dados, fotos e informações dos operadores no chão de fábrica. Pelo computador é melhor ainda, muito prático gerar relatórios, análises e acompanhar os trabalhos.',
          name: 'Fabiano de Souza',
          role: 'Técnico em Mecânica'
        }
      ]
    },
    aboutUs: {
      title: 'Quem é a Normatiza',
      subtitle: 'Uma empresa que nasceu da necessidade de serviço especializado para NR-12, unindo expertise em engenharia à tecnologia proprietária.',
      highlights: [
        { title: 'Nacional e Internacional', text: 'Clientes de consultoria em legislação e projetos', icon: 'lucideMapPin' },
        { title: 'Equipe Especializada', text: 'Engenheiros e técnicos em mecânica, elétrica, automação e segurança', icon: 'lucideUsers' },
        { title: 'Tecnologia Própria', text: 'Software de gestão NR-12 desenvolvido internamente', icon: 'lucideCode' },
        { title: '100% Focados em NR-12', text: 'Dedicados exclusivamente à segurança de máquinas desde a fundação', icon: 'lucideAward' }
      ]
    },
    cta: {
      title: 'Próximos Passos',
      tagline: 'Quanto antes a conformidade, menor o risco.',
      steps: [
        { text: 'Reunião de alinhamento técnico', icon: 'lucideCalendar' },
        { text: 'Mapeamento piloto e definição de escopo', icon: 'lucideMap' },
        { text: 'Proposta comercial', icon: 'lucideFileSignature' }
      ],
      contact: 'contato@normatiza.app',
      whatsapp: '(49) 9 9900-3954'
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
