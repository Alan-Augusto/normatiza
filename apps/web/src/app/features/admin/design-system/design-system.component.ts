import { Component, computed, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  lucidePalette,
  lucideSliders,
  lucideLayers,
  lucideMessageSquare,
  lucideCheck,
  lucideTrash2,
  lucideInfo,
  lucideAlertTriangle,
  lucideTrendingUp,
  lucideFileText,
  lucideActivity,
  lucideSearch,
  lucideX,
} from '@ng-icons/lucide';
import { ENERGY_SOURCES, ENERGY_SOURCE_LABEL, type EnergySource } from '@normatiza/shared';
import { DatePicker } from 'primeng/datepicker';
import { IconField } from 'primeng/iconfield';
import { InputIcon } from 'primeng/inputicon';
import { MultiSelect } from 'primeng/multiselect';

import { CampoComponent } from '../../../shared/components/form/campo.component';
import { MascaraDirective } from '../../../shared/components/form/mascara.directive';
import { MoedaComponent } from '../../../shared/components/form/moeda.component';
import { NumeroComponent } from '../../../shared/components/form/numero.component';

// Importações dos Componentes PrimeNG (v21 Standalone)
import { Button } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Password } from 'primeng/password';
import { Textarea } from 'primeng/textarea';
import { Select } from 'primeng/select';
import { Checkbox } from 'primeng/checkbox';
import { RadioButton } from 'primeng/radiobutton';
import { ToggleSwitch } from 'primeng/toggleswitch';
import { DataTable } from '../../../shared/components/data-table/data-table.component';
import {
  AcaoVazia,
  CabecalhoDaTabela,
  LinhaDaTabela,
  TituloDeGrupo,
} from '../../../shared/components/data-table/data-table.directives';
import { Dialog } from 'primeng/dialog';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { Tooltip } from 'primeng/tooltip';
import { Toast } from 'primeng/toast';
import { ConfirmationService, MessageService } from 'primeng/api';

@Component({
  selector: 'app-design-system',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NgIconComponent,
    Button,
    InputText,
    Password,
    Textarea,
    Select,
    Checkbox,
    RadioButton,
    ToggleSwitch,
    DataTable,
    CabecalhoDaTabela,
    LinhaDaTabela,
    AcaoVazia,
    TituloDeGrupo,
    Dialog,
    ConfirmDialog,
    Tooltip,
    Toast,
    CampoComponent,
    NumeroComponent,
    MoedaComponent,
    MascaraDirective,
    DatePicker,
    IconField,
    InputIcon,
    MultiSelect,
  ],
  providers: [
    ConfirmationService,
    MessageService,
    provideIcons({
      lucidePalette,
      lucideSliders,
      lucideLayers,
      lucideMessageSquare,
      lucideCheck,
      lucideTrash2,
      lucideInfo,
      lucideAlertTriangle,
      lucideTrendingUp,
      lucideFileText,
      lucideActivity,
      lucideSearch,
      lucideX,
    }),
  ],
  templateUrl: './design-system.component.html',
  styleUrl: './design-system.component.css',
})
export class DesignSystemComponent {
  private readonly confirmationService = inject(ConfirmationService);
  private readonly messageService = inject(MessageService);

  // Controle de Abas
  activeTab = signal<string>('foundations');

  // Variáveis para controles de formulário
  textValue = signal<string>('');
  passwordValue = signal<string>('');
  textareaValue = signal<string>('');
  switchValue = signal<boolean>(false);
  checkboxValue = signal<boolean>(false);
  radioValue = signal<string>('op1');

  // Opções para o Select (PrimeNG Dropdown)
  selectOptions = [
    { label: 'Administrador', value: 'admin' },
    { label: 'Editor', value: 'editor' },
    { label: 'Visualizador', value: 'viewer' },
  ];
  selectedOption = signal<string>('admin');

  // Campos especializados (docs/web/design_system.md §9)
  altura = signal<number | null>(1200);
  peso = signal<number | null>(4200);
  potencia = signal<number | null>(0.55);
  valor = signal<number | null>(15850);
  cnpj = signal('11222333000181');
  cpf = signal('');
  cep = signal('89700000');
  telefone = signal('');
  busca = signal('');
  data = signal<Date | null>(null);
  setores = signal<string[]>(['usinagem']);
  energias = signal<EnergySource[]>(['ELECTRIC']);
  readonly fontesDeEnergia = ENERGY_SOURCES;
  readonly opcoesDeSetor = [
    { label: 'Usinagem', value: 'usinagem' },
    { label: 'Caldeiraria', value: 'caldeiraria' },
    { label: 'Estamparia', value: 'estamparia' },
    { label: 'Expedição', value: 'expedicao' },
  ];

  rotuloDaEnergia(fonte: EnergySource): string {
    return ENERGY_SOURCE_LABEL[fonte];
  }

  // Controle de Modais
  displayNormalModal = signal<boolean>(false);

  // Dados Mockados para a Tabela e Lista
  usersList = [
    { name: 'Alan Augusto', email: 'alan@brworks.com', role: 'Administrador', status: 'Ativo' },
    { name: 'Maria Silva', email: 'maria@brworks.com', role: 'Editor', status: 'Pendente' },
    { name: 'João Santos', email: 'joao@brworks.com', role: 'Visualizador', status: 'Inativo' },
    { name: 'Rita Lopes', email: 'rita@brworks.com', role: 'Editor', status: 'Ativo' },
    { name: 'Caio Prado', email: 'caio@brworks.com', role: 'Administrador', status: 'Ativo' },
  ];

  /** A vitrine dos estados da tabela — carregando, vazia, com dados e agrupada. */
  estadoDaTabela = signal<'dados' | 'carregando' | 'vazia' | 'agrupada'>('dados');

  /**
   * Agrupar exige a lista **já ordenada** pelo campo: o `p-table` abre um grupo
   * a cada troca de valor, e fora de ordem o mesmo título apareceria três vezes.
   */
  usuariosDaVitrine = computed(() => {
    if (this.estadoDaTabela() === 'agrupada') {
      return [...this.usersList].sort((a, b) => a.role.localeCompare(b.role));
    }
    return this.estadoDaTabela() === 'dados' ? this.usersList : [];
  });

  quantosComPerfil(perfil: string): number {
    return this.usersList.filter((usuario) => usuario.role === perfil).length;
  }

  activitiesList = [
    { title: 'Documento assinado', user: 'Alan Augusto', time: 'Há 5 minutos' },
    { title: 'Nova conta criada', user: 'Maria Silva', time: 'Há 2 horas' },
    { title: 'Tentativa de login bloqueada', user: 'Sistema', time: 'Ontem' },
  ];

  // Disparar Confirmação
  confirmAction() {
    this.confirmationService.confirm({
      message: 'Tem certeza que deseja prosseguir com a exclusão deste item permanente?',
      header: 'Confirmar Exclusão',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Excluir',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      rejectButtonStyleClass: 'p-button-text',
      accept: () => {
        this.messageService.add({
          severity: 'success',
          summary: 'Excluído',
          detail: 'Item removido com sucesso.',
        });
      },
    });
  }

  // Enviar Formulário Mock
  saveModalForm() {
    this.displayNormalModal.set(false);
    this.messageService.add({
      severity: 'success',
      summary: 'Salvo',
      detail: 'Os dados do formulário foram salvos!',
    });
  }
}
