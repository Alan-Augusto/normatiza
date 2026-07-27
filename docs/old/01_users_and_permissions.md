# 01 - Usuários e Permissões (Security & Access Control)

Este documento descreve detalhadamente a arquitetura de autenticação, o modelo de controle de acesso (RBAC - Role-Based Access Control), as regras de tenant (multitenancy implícito), as políticas de contas de testes (Trial) e os fluxos de criptografia e cadastro do sistema **Normatiza**.

---

## 1. Níveis de Usuário (User Roles)

O sistema possui sete tipos de usuários representados pelo enumerador `UserType` (localizado em `Normatiza.Authorization.Model`):

| Valor (int) | Identificador (Enum) | Descrição do Perfil |
| :--- | :--- | :--- |
| **0** | `Unknown` | Usuário não identificado ou de estado corrompido. |
| **1** | `Admin` | Administrador da Plataforma. Possui acesso global aos dados e controle de faturamento/limites de todos os Engenheiros cadastrados. |
| **2** | `Engineer` | Engenheiro de Segurança principal (Dono da conta/Tenant). Cadastra clientes, analistas, gerentes e parceiros. Realiza as vistorias técnicas e assina os laudos. |
| **3** | `Analyst` | Analista técnico auxiliar vinculado a um Engenheiro. Pode registrar máquinas e preencher análises de risco de clientes aos quais foi explicitamente associado. |
| **4** | `Customer` | Usuário Cliente Final (representa a indústria ou empresa vistoriada). Tem acesso de leitura para visualizar o inventário de máquinas e baixar relatórios finalizados. |
| **5** | `Manager` | Gerente associado ao Engenheiro. Pode supervisionar e visualizar análises das empresas clientes que lhe foram designadas. |
| **6** | `GuestEngineer` | Engenheiro Convidado (Parceiro). Possui acesso parametrizado a um grupo específico de clientes para realizar auditorias ou vistorias adicionais. |

---

## 2. Controle de Acesso e Isolamento de Dados (Multitenancy)

O isolamento de dados no Normatiza é implementado de forma lógica através de filtros aplicados dinamicamente no backend. Toda consulta a entidades sensíveis do sistema passa pela validação do tipo de operador ativo.

### Regras de Escopo (Filtros de Query)
No backend (`UserController.cs`), os métodos de consulta estendem o comportamento padrão a partir do método `FilterQuery` baseando-se no `Operator.Type`:

1.  **Admin:**
    *   Visualiza e gerencia **todos** os registros de usuários e análises no banco de dados.
2.  **Engineer:**
    *   Acesso restrito aos seus próprios dados.
    *   Acesso a todos os **Analysts** criados por ele (vinculados na tabela `analyst_enginner`).
    *   Acesso a todos os **Managers** criados por ele (vinculados na tabela `manager_enginner`).
    *   Acesso a todos os **GuestEngineers** criados por ele (onde `EngineerId == Operator.Id`).
    *   Acesso a todos os **Customers** criados por ele (onde `EngineerId == Operator.Id`).
3.  **Analyst:**
    *   Acesso restrito ao próprio perfil de analista.
    *   Acesso apenas aos dados de **Customers** vinculados a ele na tabela associativa `analyst_customer`.
4.  **Manager:**
    *   Acesso restrito ao próprio perfil de gerente.
    *   Acesso apenas aos dados de **Customers** vinculados a ele na tabela associativa `manager_customer`.
5.  **GuestEngineer:**
    *   Acesso restrito ao próprio perfil de convidado.
    *   Acesso apenas aos dados de **Customers** vinculados a ele na tabela associativa `guestengineer_customer`.

> [!IMPORTANT]
> **Aviso para a Reescrita:** O multitenancy atual é fortemente acoplado a filtros inline no Entity Framework (`Where(u => u.EngineerId == Operator.Id)`). Para a nova arquitetura, é altamente recomendada a adoção de um isolamento de banco de dados mais rigoroso (como um identificador global de tenant em nível de conexão ou banco de dados físico por tenant, se aplicável) para evitar falhas de escopo.

---

## 3. Fluxo de Autenticação (Auth Flow)

A autenticação é stateless baseada em **JSON Web Tokens (JWT)**.

1.  **Requisição de Login:** O frontend envia `email` e `password` para `/login/user`.
2.  **Validação de Usuário:**
    *   Busca o usuário ativo pelo e-mail (`DisabledAt == null`).
    *   Valida se a conta de e-mail foi confirmada (`EmailConfirmed == true`).
    *   Caso seja Engenheiro do tipo **Trial**, valida se a licença não expirou e se a conta está ativa.
3.  **Comparação de Senhas:**
    *   A senha enviada é hashada utilizando o algoritmo interno (descrito na Seção 5) com o `Salt` armazenado na tabela.
    *   Caso coincida com o hash de `Password`, o login é aprovado.
4.  **Geração do Token:**
    *   O token contém `Claims` com as informações básicas do operador (ID e Role correspondente ao `UserType`).
    *   O tempo padrão de expiração do token é definido no arquivo de configuração da API (`appsettings.json`).

---

## 4. Políticas de Conta Trial (Limite de Testes)

Quando um Engenheiro cria uma conta autônoma na plataforma, as seguintes propriedades são atribuídas por padrão para controle de licenciamento e testes:

*   `IsTrialUser = true`
*   `AvaliableTrialDays = 14` (Prazo padrão de validade da conta experimental)
*   `AvaliableTrialAnalisys = 5` (Máximo de laudos concluídos que o engenheiro pode gerar)
*   `ExpiredAt = DataAtual + 14 dias`

### Regras de Validação de Limites
No momento do login e na criação de novas análises, o backend executa as seguintes validações:

*   **Validação por Data Limite:** O método `UpdateStatusTrialbyDateLimit` é chamado. Se o prazo experimental expirou (Data de criação + `AvaliableTrialDays` é menor que a Data Atual), o usuário é desabilitado (`Enabled = false`) e o login é rejeitado com a mensagem *"Usuário Inativo, licença trial inativa, favor contactar o suporte do Normatiza."*
*   **Limite de Análises Concluídas:** O Engenheiro Trial pode cadastrar clientes e máquinas, mas só pode gerar até 5 laudos técnicos completos. A propriedade `hasTrialLimit` é definida como `used < user.AvaliableTrialAnalisys`.
*   **Limitação de Time (Equipe):** Usuários do tipo Trial não podem criar analistas ou gerentes (a propriedade `hasTrialMember` restringe essa ação).
*   **Limitação de Clientes:** Engenheiros Trial podem ter no máximo 1 cliente ativo de teste por vez (bloqueado via lógica `hasTrialClient`).

### Usuários Ilimitados (Contas Pagas)
Usuários Engenheiros que adquirem o plano ilimitado possuem:
*   `IsTrialUser = false`
*   `Enabled = true`
*   `MaxAnalysis = 0` (O valor `0` indica saldo infinito de laudos no sistema).

---

## 5. Segurança de Criptografia (Passwords & Security)

A lógica de geração de senhas e validação reside na classe `APICore.Model.Authorization.Auth`.

### Geração de Salt
O salt é gerado de forma pseudoaleatória segura em nível criptográfico (32 bytes):
```csharp
public static byte[] GetSalt()
{
    using (var rng = RandomNumberGenerator.Create())
    {
        var salt = new byte[32];
        rng.GetBytes(salt);
        return salt;
    }
}
```

### Cálculo do Hash
O hash de senha utiliza o algoritmo **SHA-256**. O salt de 32 bytes é concatenado diretamente com os bytes da senha (obtidos via codificação padrão do sistema) e passado ao hasher:
```csharp
private static byte[] GetHash(string value, byte[] salt)
{
    using (var ms = new MemoryStream())
    using (var hasher = SHA256.Create())
    {
        var pw = Encoding.Default.GetBytes(value); // Obs: Utiliza codificação local/default.
        ms.Write(salt, 0, salt.Length);
        ms.Write(pw, 0, pw.Length);

        return hasher.ComputeHash(ms.ToArray());
    }
}
```

> [!WARNING]
> **Compatibilidade Criptográfica na Reescrita:** A implementação antiga concatena o salt com a string codificada usando `Encoding.Default` (que varia dependendo do sistema operacional onde a API é hospedada). Recomenda-se migrar o banco de dados e recalcular hashes usando algoritmos mais robustos como **Argon2id** ou **PBKDF2 (com SHA-512)** na nova tecnologia, criando um script ou fluxo de redefinição de senhas se necessário.
