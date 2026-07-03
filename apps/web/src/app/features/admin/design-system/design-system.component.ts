import { Component, signal, inject } from '@angular/core';
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
  lucideActivity
} from '@ng-icons/lucide';

// Importações dos Componentes PrimeNG (v21 Standalone)
import { Button } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Password } from 'primeng/password';
import { Textarea } from 'primeng/textarea';
import { Select } from 'primeng/select';
import { Checkbox } from 'primeng/checkbox';
import { RadioButton } from 'primeng/radiobutton';
import { ToggleSwitch } from 'primeng/toggleswitch';
import { TableModule } from 'primeng/table';
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
    TableModule,
    Dialog,
    ConfirmDialog,
    Tooltip,
    Toast
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
      lucideActivity
    })
  ],
  templateUrl: './design-system.component.html',
  styleUrl: './design-system.component.css'
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
    { label: 'Visualizador', value: 'viewer' }
  ];
  selectedOption = signal<string>('admin');

  // Controle de Modais
  displayNormalModal = signal<boolean>(false);

  // Dados Mockados para a Tabela e Lista
  usersList = [
    { name: 'Alan Augusto', email: 'alan@brworks.com', role: 'Administrador', status: 'Ativo' },
    { name: 'Maria Silva', email: 'maria@brworks.com', role: 'Editor', status: 'Pendente' },
    { name: 'João Santos', email: 'joao@brworks.com', role: 'Visualizador', status: 'Inativo' }
  ];

  activitiesList = [
    { title: 'Documento assinado', user: 'Alan Augusto', time: 'Há 5 minutos' },
    { title: 'Nova conta criada', user: 'Maria Silva', time: 'Há 2 horas' },
    { title: 'Tentativa de login bloqueada', user: 'Sistema', time: 'Ontem' }
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
          detail: 'Item removido com sucesso.' 
        });
      }
    });
  }

  // Enviar Formulário Mock
  saveModalForm() {
    this.displayNormalModal.set(false);
    this.messageService.add({ 
      severity: 'success', 
      summary: 'Salvo', 
      detail: 'Os dados do formulário foram salvos!' 
    });
  }
}
