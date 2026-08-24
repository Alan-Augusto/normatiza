# 03 - Regras de Negócio e Conceitos Core (Business Rules & Calculations)

Este documento especifica as regras de negócio, as fórmulas matemáticas para quantificação de risco, as diretrizes de conformidade da norma brasileira **NR-12** e a estrutura lógica das vistorias industriais realizadas no sistema **Normatiza**.

---

## 1. O Fluxo de Vistoria e Conformidade NR-12

O objetivo central do sistema é emitir um **Laudo Técnico de Conformidade NR-12**. A NR-12 é uma norma regulamentadora brasileira de saúde e segurança no trabalho que estabelece requisitos mínimos para prevenção de acidentes em máquinas e equipamentos.

O fluxo de trabalho de um engenheiro/analista na plataforma segue as seguintes etapas:
1.  **Cadastro do Cliente (Customer):** Informações da empresa proprietária das máquinas.
2.  **Abertura de uma Análise (Analysis):** Vínculo inicial entre o cliente e a máquina vistoriada.
3.  **Ficha Técnica da Máquina (Machine):** Inventário completo das características técnicas, fontes de energia e operação da máquina.
4.  **Avaliação Quantitativa de Riscos (Risk - HRN):** Identificação de pontos críticos de perigo, cálculo do nível de risco atual e cálculo do risco residual proposto.
5.  **Checklist de Sistemas de Controle (PAP - Pontos de Análise de Perigo):** Validação dos circuitos de acionamento, rearme e parada de emergência da máquina.
6.  **Inspeção de Conservação (PE - Pontos de Entropia):** Identificação de avarias, fiação exposta ou proteções danificadas (entropia física).
7.  **Estudos de Segurança (Studies):** Inclusão de desenhos de proteções propostas e diagramas lógicos se necessário.
8.  **Fechamento e Emissão de Laudos (Technical Reports):** Geração automática do arquivo Word/PDF assinado tecnicamente com ART.

---

## 2. Inventário Técnico da Máquina

Durante o Passo 2 da vistoria, o vistoriador preenche a ficha da máquina (`machine`). Esse inventário captura:
*   **Dados Físicos:** Fabricante, modelo, ano de fabricação, série, patrimônio, dimensões (altura, largura, profundidade, peso).
*   **Capacidade e Tempo:** Capacidade produtiva, postos de comando, número de operadores simultâneos expostos.
*   **Fontes de Energia Alimentadas (Boleanos):**
    *   Elétrica (`eletricEnergy`)
    *   Pneumática (`pneumaticEnergy`)
    *   Hidráulica (`hydraulicEnergy`)
    *   Mecânica (`mechanicalEnergy`)
    *   Radioativa (`radioactiveEnergy`)
*   **Gestão de Segurança Básica (Boleanos):**
    *   Possui manual de instrução em português? (`hasInstructionManual`)
    *   Possui procedimento de trabalho e segurança formalizado? (`workingAndSafetyProcedures`)
    *   Há registro físico/livro de manutenções preventivas? (`registeredPreventiveMaintenance`)
    *   Existe plano ativo de manutenção previsto? (`intendedPreventiveMaintenance`)
*   **Fotos de Reconhecimento:** Quatro vistas obrigatórias (Frontal, Lateral Esquerda, Lateral Direita, Superior) salvas na tabela `photo` com referências na máquina.

---

## 3. Avaliação Quantitativa de Risco - Metodologia HRN

O **HRN (Hazard Rating Number - Número de Classificação do Perigo)** é um método quantitativo de avaliação de riscos industriais. Ele é calculado multiplicando quatro fatores de exposição e probabilidade:

$$\text{HRN} = \text{FE} \times \text{PE} \times \text{MPL} \times \text{NP}$$

### 3.1 Definição dos Fatores do Cálculo

#### Fator 1: Frequência de Exposição (FE / `HrnFe`)
Mede com que frequência as pessoas interagem com o ponto de perigo.

| Peso (float) | Descrição no Sistema (`hrnTitles.fe`) |
| :--- | :--- |
| **0.5** | Anualmente |
| **1.0** | Mensalmente |
| **1.5** | Semanalmente |
| **2.5** | Diariamente |
| **4.0** | Em termos de hora |
| **5.0** | Constantemente |

#### Fator 2: Probabilidade de Ocorrência do Perigo (PE / `HrnPe`)
Mede a probabilidade de ocorrer o acidente devido à ausência ou falha de proteções.

| Peso (float) | Descrição no Sistema (`hrnTitles.pe`) | Lógica de Aplicação Técnica (Ajuda Visual) |
| :--- | :--- | :--- |
| **0.03** | Quase impossível | Ponto totalmente protegido. Sem chance de falha física normal. |
| **1.0** | Altamente improvável | Ponto protegido, sem sensores, mas posicionado fora da área operacional ativa. |
| **1.5** | Improvável | Situação improvável, mas concebível (ex: barreira mecânica sem sensor). |
| **2.0** | Possível | Situação possível, mas não usual (ex: proteção móvel NR-12 sem chave de segurança). |
| **5.0** | Alguma Chance | O perigo pode ser acessado de forma voluntária (aberturas médias/grandes). |
| **8.0** | Provável | O operador realiza atividades muito próximo ao ponto, sem barreira física. |
| **10.0** | Muito Provável | Operador interage diretamente com a zona ou sistema de acionamento manual aberto. |
| **15.0** | Certo | Operador trabalha em contato físico direto contínuo com a parte móvel/perigosa. |

#### Fator 3: Máxima Perda Possível (MPL / `HrnMpl`)
Representa a gravidade da lesão física que o operador sofreria no pior caso.

| Peso (float) | Descrição no Sistema (`hrnTitles.mpl`) |
| :--- | :--- |
| **0.1** | Arranhão / Contusão leve |
| **0.5** | Dilaceração / Doenças moderadas |
| **2.0** | Fratura / Enfermidade leve |
| **4.0** | Fratura / Enfermidade grave |
| **6.0** | Perda de um membro / olho |
| **10.0** | Perda de dois membros / olhos |
| **15.0** | Fatalidade |

#### Fator 4: Número de Pessoas Expostas (NP / `HrnNp`)
Quantifica o total de operadores expostos ao risco ao mesmo tempo.

| Peso (int) | Descrição no Sistema (`hrnTitles.np`) |
| :---: | :--- |
| **1** | 1-2 pessoas |
| **2** | 3-7 pessoas |
| **4** | 8-15 pessoas |
| **8** | 16-50 pessoas |
| **12** | Mais que 50 pessoas |

---

### 3.2 Classificação do Nível de Risco (Risk Levels)

Com base no produto final do cálculo do HRN, o risco é classificado em uma faixa de gravidade que define o prazo e a obrigatoriedade da intervenção de engenharia:

| Faixa de Valor (HRN) | Classificação do Risco | Nível interno (`RiskLevel`) | Classe CSS Frontend |
| :--- | :--- | :---: | :--- |
| **HRN <= 1.0** | Risco Aceitável | `Aceitavel` | `riskLevel aceitavel` |
| **1.1 a 5.0** | Risco Muito Baixo | `MuitoBaixo` | `riskLevel muitoBaixo` |
| **5.1 a 10.0** | Risco Baixo | `Baixo` | `riskLevel baixo` |
| **10.1 a 50.0** | Risco Significante | `Significante` | `riskLevel significante` |
| **50.1 a 100.0** | Risco Alto | `Alto` | `riskLevel alto` |
| **100.1 a 500.0** | Risco Muito Alto | `MuitoAlto` | `riskLevel muitoAlto` |
| **500.1 a 1000.0** | Risco Extremo | `Extremo` | `riskLevel extremo` |
| **HRN > 1000.0** | Risco Inaceitável | `Inaceitavel` | `riskLevel inaceitavel` |

### 3.3 Risco Residual (Residual HRN)
Caso o Engenheiro ative a opção `UseHrnResidual = true`, ele deverá preencher uma segunda rodada de fatores (FE, PE, MPL e NP Residuais) indicando qual será a nova classificação de risco estimada **após** a implementação das soluções de proteção propostas. O laudo final exibe um comparativo "Antes vs. Depois" evidenciando a eficácia técnica do investimento de segurança.

---

## 4. Checklists Especiais de Controle (PAP e PE)

### 4.1 Pontos de Análise de Perigo (PAP)
Avalia os botões e painéis de acionamento de segurança da máquina. A estrutura do PAP é tripla: examina-se o acionamento de **partida**, o **rearme (reset)** e a **parada de emergência**. Cada uma destas 3 seções possui 6 quesitos de verificação lógica:

1.  **Instalação (`*Installed`):** Existe o botão/dispositivo instalado?
2.  **Prevenção Involuntária (`*Accidental`):** O acionamento possui carenagem ou proteção contra toques involuntários?
3.  **Antifraude (`*AntiFraud`):** É difícil burlar ou prender o botão permanentemente (ex: com fita/arame)?
4.  **Área Segura (`*SafeArea`):** O operador consegue acionar sem precisar enfiar as mãos em partes móveis perigosas?
5.  **Extrabaixa Tensão (`*Ebt`):** O botão trabalha em tensão segura de controle (máximo 24V) para evitar choques?
6.  **Sinalização (`*Portuguese`):** Há identificação clara do comando escrita em língua portuguesa?

> [!NOTE]
> Para cada propriedade física preenchida, o vistoriador preenche a conformidade legal equivalente (`*Nr12`). Exemplo: `activationInstalled` (estado físico) e `activationInstalledNr12` (está de acordo com a regra da NR-12).

### 4.2 Pontos de Entropia (PE)
Identifica desgaste físico, envelhecimento natural ou violação deliberada de componentes da máquina. Diferente do risco isolado que analisa geometrias e perigos mecânicos de operação, o PE foca na fadiga dos componentes:
*   Dispositivo de partida com desgaste (`startupDevice` / `startupDeviceNr12`).
*   Inexistência de controle em baixa tensão no circuito exposto (`lowVoltage` / `lowVoltageNr12`).
*   Botões de rearme com acionamento comutador fixo ao invés de manual momentâneo (`manualReset` / `manualResetNr12`).
*   Ausência ou má conservação de plaquetas em português (`portuguese` / `portugueseNr12`).
*   Dispositivos de controle burlados ou danificados (`antiFraud` / `antiFraudNr12`).
*   Proteções abertas sem intertravamento ativo (`installedDevices` / `installedDevicesNr12`).
*   O acionamento de um motor faz disparar outro circuito perigoso por indução de falha (`triggeredByAnother` / `triggeredByAnotherNr12`).
*   Ausência de retenção de segurança elétrica em caso de queda de energia (`retention` / `retentionNr12`).
