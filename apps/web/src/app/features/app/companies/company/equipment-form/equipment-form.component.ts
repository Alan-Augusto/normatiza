import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AutoComplete, type AutoCompleteCompleteEvent } from 'primeng/autocomplete';
import { Button } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { Observable, TimeoutError, catchError, map, of, switchMap, timeout } from 'rxjs';

import {
  MACHINE_TYPE_CREATOR_ROLES,
  equipmentCodeForUrl,
  normalizeForSearch,
  type EquipmentDetail,
  type EquipmentRef,
  type EquipmentUpsertRequest,
  type MachineTypeOption,
  type SectorListItem,
} from '@normatiza/shared';

import { AuthService } from '../../../../../core/auth/auth.service';
import { FormularioComAlteracoes } from '../../../../../core/guards/unsaved-changes.guard';
import { mensagemDoServidor } from '../../../../../core/http/mensagem-de-erro';
import { empresaDaRota } from '../../../../../core/routing/empresa-da-rota';
import { ROTAS } from '../../../../../core/routing/rotas';
import { InventoryService } from '../../../../../core/services/inventory.service';

/** A foto de celular com folga — o mesmo teto do servidor. */
const FOTO_MAX_BYTES = 10 * 1024 * 1024;
const FOTO_TIPOS = ['image/png', 'image/jpeg', 'image/webp'];

/** Quanto cada etapa do salvar espera o servidor — a mesma regra do cadastro de empresa. */
const LIMITE_DE_ESPERA_MS = 20_000;

/**
 * Cadastro e edição do equipamento — Contexto 2 (docs/produto/03 §4.2).
 *
 * **Só o nome é obrigatório.** A ficha técnica densa se preenche na análise, e
 * um cadastro que exige o que ninguém tem em mãos no chão da fábrica não é
 * feito. Página própria, e não diálogo, pelo mesmo motivo do cadastro de
 * empresa: foto e buscas rolam por dentro e se perderiam num ESC.
 *
 * Setor e tipo são digitados livremente e resolvidos ao salvar: o que já existe
 * — sem acento nem caixa — é reaproveitado; o setor novo é criado por quem
 * cadastra; o tipo novo, só pela consultoria, dona do catálogo.
 */
@Component({
  selector: 'app-equipment-form',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, AutoComplete, Button, InputText, Message],
  templateUrl: './equipment-form.component.html',
  styleUrl: './equipment-form.component.css',
})
export class EquipmentFormComponent implements OnInit, FormularioComAlteracoes {
  private readonly inventory = inject(InventoryService);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(NonNullableFormBuilder);

  private readonly empresa = empresaDaRota();

  readonly sobreOQue = 'neste equipamento';

  readonly form = this.fb.group({
    nome: this.fb.control('', [Validators.required, Validators.maxLength(160)]),
    tipo: this.fb.control(''),
    modelo: this.fb.control(''),
    fabricante: this.fb.control(''),
    serie: this.fb.control(''),
    ano: this.fb.control(''),
    tag: this.fb.control(''),
    patrimonio: this.fb.control(''),
    setor: this.fb.control(''),
  });

  private readonly valores = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });

  readonly setores = signal<SectorListItem[]>([]);
  readonly tipos = signal<MachineTypeOption[]>([]);
  readonly setoresSugeridos = signal<string[]>([]);
  readonly tiposSugeridos = signal<string[]>([]);

  /** O código do equipamento em edição; nulo no cadastro. */
  readonly code = signal<string | null>(null);
  readonly original = signal<EquipmentDetail | null>(null);
  readonly carregando = signal(false);
  readonly salvando = signal(false);
  readonly erro = signal<string | null>(null);
  readonly erros = signal<Partial<Record<'nome' | 'tag' | 'ano', string>>>({});
  readonly tentouSalvar = signal(false);

  readonly repetidosNaSerie = signal<EquipmentRef[]>([]);
  readonly repetidosNoPatrimonio = signal<EquipmentRef[]>([]);

  readonly fotoEscolhida = signal<File | null>(null);
  readonly fotoPrevia = signal<string | null>(null);
  readonly fotoRemovida = signal(false);
  readonly erroDaFoto = signal<string | null>(null);

  readonly editando = computed(() => this.code() !== null);
  readonly bloqueado = computed(() => this.original()?.actions.edit === false);

  /** A consultoria acrescenta tipo ao catálogo; o cliente escolhe da lista. */
  readonly criaTipo = computed(() => {
    const empresa = this.empresa();
    return !!empresa && this.auth.rolesInCompany(empresa.id).some((p) => MACHINE_TYPE_CREATOR_ROLES.includes(p));
  });

  readonly setorNovo = computed(() => {
    const nome = normalizeForSearch(this.valores().setor ?? '');
    return !!nome && !this.setores().some((s) => normalizeForSearch(s.name) === nome);
  });

  readonly tipoForaDoCatalogo = computed(() => {
    const nome = normalizeForSearch(this.valores().tipo ?? '');
    const atual = this.original()?.machineType?.name;
    if (atual && normalizeForSearch(atual) === nome) return false;
    return !!nome && !this.tipos().some((t) => normalizeForSearch(t.name) === nome);
  });

  readonly rotaDeVolta = computed(() => {
    const rotas = ROTAS.empresa(this.empresa()?.slug ?? '');
    const code = this.code();
    return code ? rotas.equipamento(code).painel : rotas.equipamentos;
  });

  ngOnInit(): void {
    const empresa = this.empresa();
    if (!empresa) return;

    this.inventory.listSectors(empresa.id).subscribe({
      next: (setores) => this.setores.set(setores),
      error: () => this.setores.set([]),
    });
    this.inventory.listMachineTypes().subscribe({
      next: (tipos) => this.tipos.set(tipos),
      error: () => this.tipos.set([]),
    });

    const code = this.route.snapshot.paramMap.get('equipmentCode');
    if (code) this.carregar(empresa.id, code);
  }

  private carregar(companyId: string, code: string): void {
    this.carregando.set(true);
    this.inventory.getEquipment(companyId, code).subscribe({
      next: (equipamento) => {
        this.carregando.set(false);
        this.code.set(equipamento.code);
        this.original.set(equipamento);
        this.form.setValue({
          nome: equipamento.name,
          tipo: equipamento.machineType?.name ?? '',
          modelo: equipamento.model ?? '',
          fabricante: equipamento.manufacturerName ?? '',
          serie: equipamento.serialNumber ?? '',
          ano: equipamento.manufactureYear ? String(equipamento.manufactureYear) : '',
          tag: equipamento.tag ?? '',
          patrimonio: equipamento.patrimonyCode ?? '',
          setor: equipamento.sector?.name ?? '',
        });
        this.fotoPrevia.set(equipamento.photoUrl ?? null);
        this.form.markAsPristine();
        if (this.bloqueado()) {
          this.erro.set('Este equipamento está desativado ou fora da sua alçada: aqui ele só é lido.');
          this.form.disable();
        }
      },
      error: (erro) => {
        this.carregando.set(false);
        this.erro.set(mensagemDoServidor(erro, 'Não foi possível carregar o equipamento.'));
      },
    });
  }

  // ── Sugestões ────────────────────────────────────────────────────────────

  filtrarSetores(evento: AutoCompleteCompleteEvent): void {
    this.setoresSugeridos.set(filtrar(this.setores().map((s) => s.name), evento.query));
  }

  filtrarTipos(evento: AutoCompleteCompleteEvent): void {
    this.tiposSugeridos.set(filtrar(this.tipos().map((t) => t.name), evento.query));
  }

  // ── Avisos de repetição ──────────────────────────────────────────────────

  /** Série e patrimônio repetidos não impedem: pode ser engano, pode ser máquina idêntica. */
  conferirRepetidos(campo: 'serie' | 'patrimonio'): void {
    const empresa = this.empresa();
    const valor = this.form.controls[campo].value.trim();
    const alvo = campo === 'serie' ? this.repetidosNaSerie : this.repetidosNoPatrimonio;
    if (!empresa || !valor) {
      alvo.set([]);
      return;
    }

    this.inventory
      .duplicates(empresa.id, {
        ...(campo === 'serie' ? { serialNumber: valor } : { patrimonyCode: valor }),
        ...(this.code() ? { except: this.code()! } : {}),
      })
      .subscribe({
        next: (achados) => alvo.set(campo === 'serie' ? achados.serialNumber : achados.patrimonyCode),
        error: () => alvo.set([]),
      });
  }

  descreverRepetidos(lista: EquipmentRef[]): string {
    return lista.map((e) => `${e.code} · ${e.name}`).join(', ');
  }

  // ── Foto ─────────────────────────────────────────────────────────────────

  aoEscolherFoto(evento: Event): void {
    const arquivo = (evento.target as HTMLInputElement).files?.[0];
    this.erroDaFoto.set(null);
    if (!arquivo) return;

    if (!FOTO_TIPOS.includes(arquivo.type)) {
      this.erroDaFoto.set('A foto precisa ser PNG, JPG ou WebP.');
      return;
    }
    if (arquivo.size > FOTO_MAX_BYTES) {
      this.erroDaFoto.set('A foto pode ter no máximo 10 MB.');
      return;
    }

    this.fotoEscolhida.set(arquivo);
    this.fotoRemovida.set(false);
    this.fotoPrevia.set(typeof URL.createObjectURL === 'function' ? URL.createObjectURL(arquivo) : null);
    this.form.markAsDirty();
  }

  removerFoto(): void {
    this.fotoEscolhida.set(null);
    this.fotoPrevia.set(null);
    this.fotoRemovida.set(true);
    this.form.markAsDirty();
  }

  // ── Salvar ───────────────────────────────────────────────────────────────

  erroDe(campo: 'nome' | 'tag' | 'ano'): string | null {
    const doServidor = this.erros()[campo];
    if (doServidor) return doServidor;
    if (campo === 'nome' && this.tentouSalvar() && this.form.controls.nome.invalid) {
      return 'Informe o nome do equipamento.';
    }
    if (campo === 'ano' && this.tentouSalvar() && !anoVálido(this.form.controls.ano.value)) {
      return 'O ano de fabricação é um número de quatro dígitos, como 2012.';
    }
    return null;
  }

  temAlteracoesNaoSalvas(): boolean {
    return this.form.dirty && !this.salvando();
  }

  salvar(): void {
    this.tentouSalvar.set(true);
    this.erros.set({});
    const empresa = this.empresa();
    if (!empresa || this.bloqueado()) return;
    if (this.form.invalid || !anoVálido(this.form.controls.ano.value)) {
      this.form.markAllAsTouched();
      return;
    }

    this.salvando.set(true);
    this.erro.set(null);

    const code = this.code();
    this.resolverSetor(empresa.id)
      .pipe(
        switchMap((sectorId) => this.resolverTipo().pipe(map((machineTypeId) => this.corpo(sectorId, machineTypeId)))),
        switchMap((corpo) =>
          (code
            ? this.inventory.updateEquipment(empresa.id, code, corpo)
            : this.inventory.createEquipment(empresa.id, corpo)
          ).pipe(timeout(LIMITE_DE_ESPERA_MS)),
        ),
        switchMap((equipamento) => this.aplicarFoto(empresa.id, equipamento)),
      )
      .subscribe({
        next: (equipamento) => {
          this.salvando.set(false);
          this.form.markAsPristine();
          const rotas = ROTAS.empresa(this.empresa()?.slug ?? '');
          if (code) {
            void this.router.navigateByUrl(rotas.equipamento(equipamento.code).painel);
          } else {
            void this.router.navigate([rotas.equipamentos], {
              queryParams: { cadastrado: equipmentCodeForUrl(equipamento.code) },
            });
          }
        },
        error: (erro) => {
          this.salvando.set(false);
          this.recusado(erro);
        },
      });
  }

  /** O setor digitado vira id: o existente, sem acento nem caixa, ou um criado agora. */
  private resolverSetor(companyId: string): Observable<string | null> {
    const nome = this.form.controls.setor.value.trim();
    if (!nome) return of(null);
    const existente = this.setores().find((s) => normalizeForSearch(s.name) === normalizeForSearch(nome));
    if (existente) return of(existente.id);
    return this.inventory.createSector(companyId, { name: nome }).pipe(
      timeout(LIMITE_DE_ESPERA_MS),
      map((setor) => setor.id),
    );
  }

  /**
   * O tipo digitado vira id. Fora do catálogo, a consultoria o acrescenta; o
   * cliente deixa em branco — o hint na tela já disse que a consultoria
   * classifica depois.
   */
  private resolverTipo(): Observable<string | null> {
    const nome = this.form.controls.tipo.value.trim();
    if (!nome) return of(null);
    // O tipo que a máquina já tem conta como conhecido mesmo que a lista não o
    // traga — ela pode ter falhado ao carregar, e recriá-lo seria duplicar.
    const conhecidos = [...this.tipos(), ...(this.original()?.machineType ? [this.original()!.machineType!] : [])];
    const existente = conhecidos.find((t) => normalizeForSearch(t.name) === normalizeForSearch(nome));
    if (existente) return of(existente.id);
    if (!this.criaTipo()) return of(null);
    return this.inventory.createMachineType(nome).pipe(
      timeout(LIMITE_DE_ESPERA_MS),
      map((tipo) => tipo.id),
    );
  }

  private corpo(sectorId: string | null, machineTypeId: string | null): EquipmentUpsertRequest {
    const v = this.form.getRawValue();
    return {
      name: v.nome.trim(),
      machineTypeId,
      model: v.modelo,
      manufacturerName: v.fabricante,
      serialNumber: v.serie,
      manufactureYear: v.ano.trim() ? Number(v.ano) : null,
      tag: v.tag,
      patrimonyCode: v.patrimonio,
      sectorId,
    };
  }

  /** Falha da foto não desfaz o cadastro: a máquina existe, e a foto se envia de novo pela edição. */
  private aplicarFoto(companyId: string, equipamento: EquipmentDetail): Observable<EquipmentDetail> {
    const arquivo = this.fotoEscolhida();
    const operação: Observable<unknown> | null = arquivo
      ? this.inventory.setPhoto(companyId, equipamento.code, arquivo)
      : this.fotoRemovida() && this.original()?.photoUrl
        ? this.inventory.removePhoto(companyId, equipamento.code)
        : null;
    if (!operação) return of(equipamento);

    return operação.pipe(
      timeout(LIMITE_DE_ESPERA_MS),
      map(() => equipamento),
      catchError(() => of(equipamento)),
    );
  }

  private recusado(erro: unknown): void {
    if (erro instanceof TimeoutError) {
      this.erro.set(
        `O servidor não respondeu em ${LIMITE_DE_ESPERA_MS / 1000} segundos. O que você preencheu ` +
          'continua aqui: tente de novo. Se o equipamento já aparecer no inventário, o cadastro tinha chegado.',
      );
      return;
    }
    const campo = erro instanceof HttpErrorResponse ? (erro.error as { field?: string })?.field : undefined;
    const mensagem = mensagemDoServidor(erro, 'Não foi possível salvar o equipamento.');
    const doCampo = { name: 'nome', tag: 'tag', manufactureYear: 'ano' } as const;
    const alvo = campo ? doCampo[campo as keyof typeof doCampo] : undefined;
    if (alvo) this.erros.set({ [alvo]: mensagem });
    else this.erro.set(mensagem);
  }
}

function anoVálido(valor: string): boolean {
  return !valor.trim() || /^\d{4}$/.test(valor.trim());
}

/** Sugere o que contém o digitado, sem acento nem caixa; campo vazio mostra tudo. */
function filtrar(nomes: string[], consulta: string): string[] {
  const termo = normalizeForSearch(consulta ?? '');
  return termo ? nomes.filter((n) => normalizeForSearch(n).includes(termo)) : nomes;
}
