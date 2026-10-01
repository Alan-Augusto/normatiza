/**
 * O modal aberto, como quem o abriu e quem está dentro dele o enxergam. O
 * componente de dentro injeta o `ModalRef` e se fecha com o resultado; quem
 * abriu espera `fechado`. Fechar pelo X, pelo ESC ou por fora devolve `undefined`.
 */
export class ModalRef<R = unknown> {
  readonly fechado: Promise<R | undefined>;
  private resolver!: (resultado: R | undefined) => void;
  private aberto = true;

  constructor(private readonly aoFechar: () => void) {
    this.fechado = new Promise((resolve) => (this.resolver = resolve));
  }

  fechar(resultado?: R): void {
    if (!this.aberto) return;
    this.aberto = false;
    this.aoFechar();
    this.resolver(resultado);
  }
}
