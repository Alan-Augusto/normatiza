import { urlDeLeituraNoEmulador } from './firebase.storage';

describe('FirebaseStorage no emulador', () => {
  const chave = 'accounts/c1/companies/e1/logo/abc';
  const objeto = 'accounts%2Fc1%2Fcompanies%2Fe1%2Flogo%2Fabc';

  it('deve ler o arquivo por URL direta, porque sem conta de serviço não há como assinar', () => {
    const url = urlDeLeituraNoEmulador('http://192.168.15.15:9199', 'demo.appspot.com', chave);

    expect(url).toBe(`http://192.168.15.15:9199/v0/b/demo.appspot.com/o/${objeto}?alt=media`);
  });

  it('deve montar a URL sobre o endereço público quando o emulador está atrás do site', () => {
    const url = urlDeLeituraNoEmulador(
      'https://normatiza.alanaugusto.dev/arquivos-emulador/',
      'demo.appspot.com',
      chave,
    );

    expect(url).toBe(
      `https://normatiza.alanaugusto.dev/arquivos-emulador/v0/b/demo.appspot.com/o/${objeto}?alt=media`,
    );
  });
});
