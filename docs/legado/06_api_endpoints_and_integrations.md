# 06 - Catálogo de Endpoints e Integrações (API Spec & Services)

Este documento descreve detalhadamente o catálogo de rotas da API backend do **Normatiza**, o modelo genérico de roteamento herdado do controlador base (`EntityController`), o dicionário de rotas específicas e o funcionamento das integrações com serviços de terceiros.

---

## 1. Arquitetura de Roteamento da API

O roteamento da API segue um padrão customizado definido na classe `APICore.Config.ApiConfigExtension` através do método de extensão `CoreRoute`:

*   **Template das Rotas:** `api/{controller}.{action}/{id?}/{type?}`

Diferente do padrão RESTful clássico (que utiliza caminhos baseados em substantivos e métodos HTTP para definir ações), o roteamento do Normatiza combina o nome do controlador (sem o sufixo `Controller`) com a ação explícita precedida por um ponto (ex: `api/user.list`, `api/sector.add`).

---

## 2. Endpoints CRUD Genéricos (`EntityController`)

A maioria dos controladores do sistema estende a classe abstrata `EntityController<CTX, OP, I, DTO, PK>`. Ao herdarem esta classe, os controladores ganham automaticamente as seguintes rotas e comportamentos padrão, caso não os redefinam:

| Rota HTTP | Método | Ação Base | Descrição |
| :--- | :---: | :---: | :--- |
| `api/{controller}.list` | `POST` | `GetList` | Retorna lista de registros com suporte a paginação, filtros complexos e ordenação (`APIQuery`). |
| `api/{controller}.key/{id}` | `GET` | `GetByKey` | Busca um único registro projetado para DTO utilizando a chave primária (`id`). |
| `api/{controller}.add` | `POST` | `Add` | Insere um novo registro no banco após executar as validações locais. |
| `api/{controller}.update` | `POST`/`PUT` | `Update` | Atualiza propriedades do registro existente. |
| `api/{controller}.delete/{id}` | `POST`/`DELETE`| `Delete` | Remove logicamente ou fisicamente o registro do banco de dados. |
| `api/{controller}.export` | `POST` | `ExportData` | Exporta a listagem filtrada para os formatos **CSV**, **PDF** ou **XLSX**. |

### Payload Padrão de Consulta (`APIQuery`)
O endpoint `.list` consome o objeto `APIQuery` enviado no corpo da requisição:
*   `page` (int): Página atual (1-based).
*   `perPage` (int): Quantidade de itens por página.
*   `usePager` (bool): Habilita ou desabilita a paginação física.
*   `fields` (list): Array de strings especificando os campos que devem ser selecionados (reduzindo tráfego SQL).
*   `filters` (list): Dicionário de filtros lógicos aplicados na consulta.
*   `sort` (list): Campos e direções de ordenação (ex: `[["id", "DESC"]]`).

---

## 3. Catálogo de Controladores e Rotas Customizadas

### 3.1 Login (`LoginController` -> `api/login`)
*   `POST api/login.user`: Autentica o usuário a partir de e-mail e senha.
    *   *Resposta:* Retorna o token JWT de acesso (`accessToken`), data de expiração (`expiresIn`) e DTO detalhado do perfil do usuário (`LoginUser`).

### 3.2 Usuários (`UserController` -> `api/user`)
Estende o CRUD base e implementa:
*   `GET api/user.limit/{id?}`: Busca o limite de análises e o status de testes (Trial) do usuário.
*   `POST api/user.limit`: Salva ou altera a cota máxima de análises (apenas para Admin).
*   `POST api/user.limit-consume`: Salva histórico de alterações/consumo do saldo de análises.
*   `POST api/user.login-info`: Retorna os dados do operador atualizado para validação de sessões.
*   `GET api/user.photo/{id?}`: Retorna a URL da foto de perfil.
*   `POST api/user.photo`: Realiza o upload ou alteração da imagem de perfil.
*   `GET api/user.token`: Valida o token JWT ativo (utilizado nas rotas privadas do React).
*   `GET api/user.findByMail`: Pesquisa se um endereço de e-mail já existe cadastrado no banco.
*   `POST api/user.UpdateAnalistCliet`: Vincula um Analista a um Cliente corporativo.
*   `POST api/user.DeleteAnalistCliet`: Desvincula um Analista de um Cliente.
*   `GET api/user.logoClients`: Retorna os logotipos dos clientes cadastrados.
*   `POST api/user.GenerateNewLinkConfirmation`: Gera e reenvia o e-mail com token de ativação de conta.

### 3.3 Senhas (`PasswordController` -> `api/password`)
*   `GET api/password.token/{token}`: Verifica se um token de recuperação de senha é válido e não expirou.
*   `POST api/password.recover`: Dispara o e-mail de recuperação de senha com o link de redefinição.
*   `POST api/password.change`: Altera a senha do usuário utilizando o token de recuperação ativo.
*   `POST api/password.confirm`: Define a senha no primeiro acesso para usuários do tipo Cliente.
*   `POST api/password.confirmEnginner`: Define a senha no primeiro acesso para novos Engenheiros cadastrados.

### 3.4 Dashboard (`DashboardController` -> `api/dashboard`)
*   `GET api/dashboard.engineer`: Estatísticas consolidadas para o painel do Engenheiro (quantidade de clientes, total de laudos gerados, saldo de laudos e riscos cadastrados).
*   `GET api/dashboard.client`: Estatísticas resumidas de conformidade para o painel do Cliente Final.

### 3.5 Análise e Vistorias (`AnalysisController` -> `api/analysis`)
Estende o CRUD base e implementa:
*   `POST api/analysis.complete/{id}`: Finaliza a vistoria e bloqueia a máquina/análise para novas edições, gravando a data de encerramento.
*   `GET api/analysis.lists`: Retorna um consolidado de tabelas de consulta (Normas regulamentadoras, origens e consequências de perigos) em formato JSON para cache offline no frontend.
*   `GET api/analysis.report/{id}?pdf={bool}`: Aciona o pipeline de geração de Laudos (Word ou PDF bloqueado) para a inspeção informada.

### 3.6 Estudos Conceituais (`StudiesController` -> `api/studies`)
Estende o CRUD base e implementa:
*   `POST api/studies.complete/{id}`: Finaliza o estudo conceitual de segurança.
*   `GET api/studies.descriptionSecurity`: Lista descrições técnicas de segurança pré-salvas.
*   `POST api/studies.descriptionSecurity`: Adiciona nova descrição padrão.
*   `GET api/studies.featuresSecurity`: Lista características técnicas de proteção pré-salvas.
*   `POST api/studies.featuresSecurity`: Adiciona nova característica técnica padrão.
*   `POST api/studies.addStudiesRelations`: Associa um sistema de segurança ou relação de dispositivos ao estudo corrente.
*   `POST api/studies.removeStudiesRelations`: Remove dispositivo do estudo.
*   `POST api/studies.addImage`: Faz upload de imagem esquemática para o estudo conceitual.
*   `POST api/studies.removeImage`: Apaga imagem esquemática do estudo.
*   `GET api/studies.report/{id}?pdf={bool}`: Emite o relatório finalizado do Estudo de Proteção Proposta.

### 3.7 Laudos de Terceiros e Arquivos Técnicos (`TechnicalReportsController` & `UserDocsController`)
*   `POST api/technicalreports.uploadfile/{id}/{type}`: Faz upload do laudo em formato PDF diretamente para a subpasta do cliente no Firebase Storage.
*   `GET api/technicalreports.downloadfileurl/{id}`: Gera a URL pública temporária para download do arquivo.
*   `GET api/technicalreports.validcustumer/{id}`: Verifica as permissões de acesso do operador logado aos arquivos do cliente `:id`.

---

## 4. Arquitetura de Integrações Externas

O backend interage com quatro serviços externos essenciais para o funcionamento do sistema:

### 4.1 Firebase Storage (Hospedagem de Imagens e Documentos)
O sistema não armazena fotos diretamente no servidor web. Utiliza o SDK `FirebaseStorage.net` para salvar e recuperar arquivos em nuvem:
*   **Upload:** As fotos tiradas em campo (máquinas, pontos de perigo, botões de comando) são enviadas para a pasta `customer-{id}/` no Firebase.
*   **Download:** O sistema solicita URLs assinadas temporárias (`GetUrlFile`) do Firebase para renderizar as imagens no frontend e embuti-las nos relatórios OpenXML.

### 4.2 ConvertAPI (Conversão de Documentos DOCX -> PDF)
Serviço essencial do pipeline de relatórios.
*   **Função:** A API backend constrói o laudo no formato Word (`.docx`). Ela envia o arquivo binário para o ConvertAPI que retorna os bytes do arquivo convertido em formato PDF.
*   **Token Utilizado:** `cBLw8yLJKgxY772V` (hospedado de forma estática no arquivo `ReportUtils.cs`).

### 4.3 SendGrid / SMTP (Envio de E-mails Transacionais)
Utilizado para confirmação de conta, boas-vindas e redefinição de senhas.
*   **Modo de Envio:** Conectado via SMTP ou API SendGrid com credenciais armazenadas na seção `MailSettings` do arquivo de configuração `appsettings.json`.

### 4.4 ViaCEP (Preenchimento Automático de Endereço)
Consumido diretamente pelo frontend no momento do cadastro de novos clientes ou usuários.
*   **Endpoint:** `https://viacep.com.br/ws/{cep}/json/`
*   **Função:** Preenche dinamicamente Logradouro, Bairro, Cidade e Estado após o preenchimento do campo de CEP.
