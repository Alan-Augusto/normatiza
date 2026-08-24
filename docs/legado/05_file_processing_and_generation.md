# 05 - Geração e Processamento de Arquivos (Report Generation & PDF Lock)

Este documento especifica a engenharia do pipeline de geração de relatórios do sistema **Normatiza**, detalhando como os laudos em Word (DOCX) e PDF são renderizados, as ferramentas OpenXML empregadas, o fluxo de comunicação com o Firebase Storage e as políticas de segurança aplicadas nos arquivos finais.

---

## 1. Visão Geral do Fluxo de Geração

Os Laudos Técnicos de Conformidade NR-12 e Estudos Conceituais são gerados de forma híbrida: a montagem lógica do conteúdo é realizada no formato Microsoft Word (DOCX) e, opcionalmente, o arquivo resultante é enviado a uma API SaaS de conversão para compilação do PDF final.

### Arquitetura de Geração de Arquivos

```
+--------------------+
|  Firebase Storage  | <---+ (1) Baixa os templates .docx e categorias (1.jpg, 2.jpg)
+----------+---------+
           |
           v [Template Bytes]
+----------+---------+
|     API (.NET)     | <---+ (2) Busca dados do banco e fotos da máquina do Firebase
|   OpenXML Parser   |
+----------+---------+
           |
           v [Compilado DOCX Bytes]
+----------+---------+
|     ConvertAPI     | <---+ (3) Envia DOCX para conversão na Nuvem
+----------+---------+
           |
           v [PDF cru]
+----------+---------+
|   PDFSharp Locker  | <---+ (4) Aplica senhas de proprietário e restrições de cópia/edição
+----------+---------+
           |
           v [PDF Blob]
+----------+---------+
|      Client        |
+--------------------+
```

---

## 2. Repositório de Templates (Firebase Storage)

Em vez de manter os arquivos Word estáticos no servidor web local, todos os templates visuais e imagens de categorias de segurança são hospedados no **Firebase Storage** sob a pasta parametrizada `ReportFolder`.

Os arquivos chave localizados no Firebase são:
*   `AnalysisTemplate.docx`: Estrutura principal do Laudo Técnico (NR-12).
*   `RiskTemplate.docx`: Sub-template contendo a tabela de perigo, foto do ponto e justificativas.
*   `HrnResidualTemplate.docx`: Tabela comparativa de HRN Residual.
*   `PapTemplate.docx`: Layout da vistoria de Pontos de Análise de Perigo.
*   `PeTemplate.docx`: Layout de Pontos de Entropia.
*   `InventoryTemplate.docx`: Layout do inventário geral de máquinas do cliente.
*   `Category/1.jpg` a `5.jpg`: Imagens representativas de categorias de controle (Categoria 1 a 4).

---

## 3. Mecanismo de Montagem OpenXML (DOCX Templating)

O processamento do arquivo DOCX utiliza a biblioteca **DocumentFormat.OpenXml**. O backend monta o arquivo programaticamente seguindo estes padrões:

### 3.1 Substituição de Tags por Regex
Os arquivos de template possuem marcadores com chaves duplas `{{tag}}`. O gerador (`AnalysisReport.cs`) varre o corpo do documento XML descobrindo elementos de texto (`Text`) que casam com o padrão de Regex `{{.*?}}` e realiza a substituição dinâmica:

```csharp
text.Text = text.Text
    .Replace("{{count}}", $"{count}")
    .Replace("{{local}}", risk.Local)
    .Replace("{{solution}}", risk.Solution)
    .Replace("{{category}}", categoryText)
    .Replace("{{hrnResult}}", $"{hrnResult.ToString("N2")} - {hrnResultMessage}");
```

### 3.2 Inserção de Imagens e Redimensionamento
As fotos das máquinas e de seus pontos de risco são baixadas do Firebase Storage via HTTP como um Stream e inseridas no DOCX através das seguintes operações:
1.  Adiciona uma nova parte de imagem ao documento principal (`MainDocumentPart.AddImagePart(ImagePartType.Jpeg)`).
2.  Alimenta os bytes da imagem na nova parte (`FeedData(stream)`).
3.  Calcula o tamanho final da imagem proporcionalmente em pixels e converte para **EMUs (English Metric Units)** de forma a caber na largura da tabela (usando o método de cálculo `ReportUtils.CalcImageSize` limitado a uma largura máxima de 205px e altura de 125px para riscos).
4.  Gera o elemento XML de desenho (`Drawing`) com o relacionamento correspondente e o insere substituindo a tag textual `{{photo}}`.

### 3.3 Shading Dinâmico por Classificação de Risco
Para facilitar a leitura visual do laudo, a cor de fundo das células que mostram a gravidade do perigo é pintada dinamicamente via código de acordo com o resultado do HRN:

```csharp
private static string getHrnColor(decimal hrnResult)
{
    return hrnResult > 1 && hrnResult <= 5 ? "00b0f0"       // Muito Baixo: Azul claro
        : hrnResult > 5 && hrnResult <= 10 ? "0000cc"       // Baixo: Azul escuro
        : hrnResult > 10 && hrnResult <= 50 ? "ffc000"      // Significante: Laranja/Amarelo
        : hrnResult > 50 && hrnResult <= 100 ? "ff0000"     // Alto: Vermelho
        : hrnResult > 100 && hrnResult <= 500 ? "c00000"    // Muito Alto: Vermelho escuro
        : hrnResult > 500 && hrnResult <= 1000 ? "800000"   // Extremo: Vinho
        : hrnResult > 1000 ? "660066"                       // Inaceitável: Roxo
        : "006600";                                         // Aceitável: Verde
}
```
Essa cor em hexadecimal é gravada na propriedade `Shading.Fill` da célula da tabela XML do Word.

---

## 4. O Pipeline de Conversão para PDF (ConvertAPI)

Quando o usuário solicita a versão em PDF do Laudo ou Estudo, o backend executa os seguintes passos síncronos:

1.  **Geração do DOCX Temporário:** O fluxo do OpenXML finaliza o processamento e gera um array de bytes contendo o arquivo DOCX. Este arquivo é escrito em disco no servidor com um nome temporário baseado em Guid (`{guid}.docx`).
2.  **Envio ao ConvertAPI:** A API conecta-se à plataforma **ConvertAPI** (utilizando a chave de licença `cBLw8yLJKgxY772V`) enviando o arquivo DOCX gerado localmente.
3.  **Conversão na Nuvem:** O serviço externo processa o documento e responde síncronamente enviando o arquivo compilado em formato PDF.
4.  **Download do PDF Temporário:** O arquivo PDF cru é salvo localmente no disco (`{guid}.pdf`).

---

## 5. Criptografia e Bloqueio de Segurança de Laudos (PDF Security Lock)

Para assegurar que o laudo NR-12 não seja manipulado ou fraudado após a assinatura técnica do Engenheiro, o sistema implementa políticas rígidas de bloqueio no arquivo PDF antes de disponibilizá-lo para download.

Usando a biblioteca **PdfSharp**, o arquivo `{guid}.pdf` é lido e suas configurações de segurança são alteradas da seguinte forma:

```csharp
PdfDocument Pdf = PdfReader.Open($"{path}.pdf", PdfDocumentOpenMode.Modify);
PdfSecuritySettings securitySettings = Pdf.SecuritySettings;

// Restrições Aplicadas:
securitySettings.PermitAccessibilityExtractContent = false; // Bloqueia leitura de texto por leitores de tela simples
securitySettings.PermitAnnotations = false;                 // Bloqueia adição/modificação de anotações
securitySettings.PermitAssembleDocument = false;            // Bloqueia junção ou corte de páginas
securitySettings.PermitExtractContent = false;              // Bloqueia cópia de textos e imagens (Ctrl+C / Ctrl+V)
securitySettings.PermitFormsFill = true;                   // Permite preenchimento de formulários (se houver)
securitySettings.PermitModifyDocument = false;             // Bloqueia edições gerais no conteúdo
securitySettings.PermitFullQualityPrint = true;            // Permite impressão em alta qualidade (para arquivamento)
securitySettings.PermitPrint = true;                       // Permite impressão física

// Senha do Proprietário:
securitySettings.OwnerPassword = guid;                     // Tranca o PDF com uma senha única Guid gerada em tempo de execução
```
*   **Senha de Usuário:** Nula (o cliente abre o PDF livremente sem digitar senha).
*   **Senha de Proprietário:** Definida como o GUID aleatório temporário. Isso impede que qualquer software comum de PDF consiga destravar o documento para edição sem a chave única gerada na transação.
*   **Limpeza de Disco:** Os arquivos locais `{guid}.docx` e `{guid}.pdf` são imediatamente apagados do disco rígido do servidor, retornando apenas os bytes do PDF seguro no payload HTTP.

> [!WARNING]
> **Ponto de Atenção para a Reescrita:** O token do ConvertAPI (`cBLw8yLJKgxY772V`) está embutido diretamente no código-fonte (hardcoded). Na nova versão, essa chave e quaisquer outras credenciais externas devem ser extraídas para variáveis de ambiente seguras ou gerenciadas no arquivo de configurações de segredos da plataforma.
