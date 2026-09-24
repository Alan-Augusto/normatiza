import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CompanyLogoComponent } from './company-logo.component';

/**
 * O logo ao lado do nome da empresa. Enfeite de reconhecimento — o nome vem
 * sempre ao lado —, então nunca pode deixar um buraco na linha.
 */
describe('CompanyLogoComponent', () => {
  let fixture: ComponentFixture<CompanyLogoComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [CompanyLogoComponent] });
    fixture = TestBed.createComponent(CompanyLogoComponent);
  });

  function montar(url: string | undefined) {
    fixture.componentRef.setInput('url', url);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('deve mostrar o logo da empresa, sem repetir o nome para o leitor de tela', () => {
    const raiz = montar('https://arquivos.teste/logo.png');

    const img = raiz.querySelector('img')!;
    expect(img.getAttribute('src')).toBe('https://arquivos.teste/logo.png');
    expect(img.getAttribute('alt')).toBe('');
    expect(raiz.querySelector('ng-icon')).toBeNull();
  });

  it('deve mostrar o ícone de empresa quando não há logo', () => {
    const raiz = montar(undefined);

    expect(raiz.querySelector('img')).toBeNull();
    expect(raiz.querySelector('ng-icon')).not.toBeNull();
  });

  it('deve cair no ícone quando o logo não carrega — a URL assinada pode ter vencido', () => {
    const raiz = montar('https://arquivos.teste/vencido.png');

    raiz.querySelector('img')!.dispatchEvent(new Event('error'));
    fixture.detectChanges();

    expect(raiz.querySelector('img')).toBeNull();
    expect(raiz.querySelector('ng-icon')).not.toBeNull();
  });

  it('deve tentar de novo quando chega outro logo', () => {
    const raiz = montar('https://arquivos.teste/vencido.png');
    raiz.querySelector('img')!.dispatchEvent(new Event('error'));
    fixture.detectChanges();

    montar('https://arquivos.teste/novo.png');

    expect(raiz.querySelector('img')?.getAttribute('src')).toBe('https://arquivos.teste/novo.png');
  });
});
