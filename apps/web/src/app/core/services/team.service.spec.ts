import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

import { API_BASE_URL } from '../auth/api.config';
import { BRF } from '../auth/testing/sessao';
import { TeamService } from './team.service';
import { EQUIPE, EQUIPE_DA_BRF, prévia } from './testing/equipe';

/**
 * O serviço que atende as duas telas de equipe.
 *
 * O que se verifica aqui é o contrato de rede — que rota, que verbo, que corpo.
 * Alçada não aparece: quem pode o quê vem do servidor em `actions`, e conferir
 * isso na tela seria manter uma segunda cópia de uma regra de autorização.
 */
describe('TeamService', () => {
  let service: TeamService;
  let http: HttpTestingController;

  const API = 'http://api.teste';

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: API },
      ],
    });
    service = TestBed.inject(TeamService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  describe('a equipe da conta', () => {
    it('deve buscar quem tem acesso à conta', async () => {
      const promessa = firstValueFrom(service.listTeam());

      const req = http.expectOne(`${API}/users`);
      expect(req.request.method).toBe('GET');

      req.flush(EQUIPE);
      expect(await promessa).toHaveLength(EQUIPE.length);
    });

    it('deve levar os filtros escolhidos para o servidor', async () => {
      const promessa = firstValueFrom(
        service.listTeam({ role: 'MANAGER', companyId: BRF.id, status: 'ACTIVE' }),
      );

      const req = http.expectOne(
        (r) => r.url === `${API}/users` && r.params.get('role') === 'MANAGER',
      );
      expect(req.request.params.get('companyId')).toBe(BRF.id);
      expect(req.request.params.get('status')).toBe('ACTIVE');

      req.flush([]);
      await promessa;
    });

    it('não deve mandar filtro que a pessoa não escolheu', async () => {
      // `?role=` vazio não é "todos os papéis" para o servidor: é um valor que
      // não existe no enum, e a resposta seria 400 numa lista sem filtro nenhum.
      const promessa = firstValueFrom(service.listTeam({ status: 'INVITED' }));

      const req = http.expectOne((r) => r.url === `${API}/users`);
      expect(req.request.params.has('role')).toBe(false);
      expect(req.request.params.has('companyId')).toBe(false);

      req.flush([]);
      await promessa;
    });
  });

  describe('a equipe de uma empresa', () => {
    it('deve buscar pela rota da empresa, e não pela lista da conta filtrada', async () => {
      // São duas projeções, não uma com filtro: esta não nomeia outra empresa
      // nem a conta. Cair em `/users?companyId=` traria o escopo de cada pessoa
      // junto, e o Marcos descobriria que a Carla também atende a Seara.
      const promessa = firstValueFrom(service.listCompanyMembers(BRF.id));

      const req = http.expectOne(`${API}/companies/${BRF.id}/members`);
      expect(req.request.method).toBe('GET');

      req.flush(EQUIPE_DA_BRF);
      expect(await promessa).toHaveLength(EQUIPE_DA_BRF.length);
    });
  });

  describe('o vínculo', () => {
    it('deve declarar o conjunto final de papéis, não um acréscimo', async () => {
      const promessa = firstValueFrom(
        service.updateMembership('m-brf-marcos', { roles: ['MANAGER', 'DIRECTOR'] }),
      );

      const req = http.expectOne(`${API}/memberships/m-brf-marcos`);
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual({ roles: ['MANAGER', 'DIRECTOR'] });

      req.flush(null);
      await promessa;
    });

    it('deve remover da empresa mexendo no vínculo, nunca no usuário', async () => {
      // Sair da BRF não é sair da Normatiza (D8). Se esta chamada fosse em
      // `/users/:id`, o Marcos apagaria da conta alguém que ele só podia tirar
      // da empresa dele.
      const promessa = firstValueFrom(service.removeFromCompany('m-brf-paulo'));

      const req = http.expectOne(`${API}/memberships/m-brf-paulo`);
      expect(req.request.method).toBe('DELETE');

      req.flush(null);
      await promessa;
    });
  });

  describe('o desligamento', () => {
    it('deve consultar antes o que a saída quebra', async () => {
      const promessa = firstValueFrom(service.disablePreview('u-marcos'));

      const req = http.expectOne(`${API}/users/u-marcos/disable-preview`);
      expect(req.request.method).toBe('GET');

      req.flush(prévia({ requiresSuccessor: true, successorReasons: ['Último Gestor da BRF.'] }));
      expect((await promessa).requiresSuccessor).toBe(true);
    });

    it('deve levar o sucessor escolhido junto do desligamento', async () => {
      const promessa = firstValueFrom(
        service.disable('u-marcos', { successorUserId: 'u-outro', reason: 'saiu da empresa' }),
      );

      const req = http.expectOne(`${API}/users/u-marcos/disable`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        successorUserId: 'u-outro',
        reason: 'saiu da empresa',
      });

      req.flush(null);
      await promessa;
    });
  });

  describe('o convite', () => {
    it('deve criar o convite com papel e escopo', async () => {
      const promessa = firstValueFrom(
        service.invite({
          name: 'Novo',
          email: 'novo@brf.com',
          roles: ['EXECUTOR'],
          companyIds: [BRF.id],
        }),
      );

      const req = http.expectOne(`${API}/invitations`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body.companyIds).toEqual([BRF.id]);

      req.flush({ id: 'inv-novo' });
      await promessa;
    });

    it('deve reenviar e revogar pelo id do convite', async () => {
      const reenvio = firstValueFrom(service.resendInvitation('inv-rafael'));
      const req1 = http.expectOne(`${API}/invitations/inv-rafael/resend`);
      expect(req1.request.method).toBe('POST');
      req1.flush(null);
      await reenvio;

      const revogação = firstValueFrom(service.revokeInvitation('inv-rafael'));
      const req2 = http.expectOne(`${API}/invitations/inv-rafael`);
      expect(req2.request.method).toBe('DELETE');
      req2.flush(null);
      await revogação;
    });
  });
});
