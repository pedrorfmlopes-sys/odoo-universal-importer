# Documentação Técnica: Módulo Catalog Enricher

## 1. Visão Geral
O **Catalog Enricher** é um módulo independente dentro do Odoo Universal Importer projetado para enriquecer catálogos de produtos a partir de ficheiros Excel básicos.
O seu objetivo principal é transformar uma lista simples de referências (Product Codes) em dados ricos, extraindo automaticamente:
- Imagens de alta resolução.
- Ficheiros PDF (Fichas Técnicas).
- Desenhos Técnicos (CAD/3D).
- Especificações técnicas via Web Scraping.

## 2. Arquitetura do Sistema
O módulo foi construído com uma arquitetura modular para não interferir com o núcleo do importador Odoo existente.

### Backend (Server)
- **Base de Dados:** Utiliza **SQLite** (`server/data/importer.db`) separada da lógica principal, garantindo portabilidade e zero dependências de servidores SQL externos.
- **Isolamento:** Todo o código reside em `server/src/modules/catalogEnricher`.
- **API:** Expõe endpoints REST em `/api/catalog-enricher/...`.
- **Motor de Extração:** Utiliza lógica de "Pattern matching" (correspondência de padrões) para deduzir URLs baseados em códigos de produtos.

### Frontend (Client)
- **Interface:** Desenvolvida em React, localizada em `client/src/modules/catalogEnricher`.
- **Navegação:** Possui as suas próprias rotas e páginas, acessíveis via `/catalog-enricher`.

## 3. Fluxo de Trabalho (Workflow)

### Passo 1: Upload (Ingestão)
- O utilizador carrega um ficheiro Excel/CSV com uma lista de produtos.
- O sistema armazena o ficheiro e pré-visualiza as colunas.

### Passo 2: Configuração do "Brand Dossier" (Inteligência)
Esta é a parte central do módulo. O utilizador "ensina" o sistema como encontrar dados para uma marca específica.
- **Dossier:** Um perfil reutilizável para uma marca (ex: Bosch, Makita).
- **Pattern Learning:** O utilizador fornece **UM** exemplo real (Código + URL).
- **Deteção:** O sistema analisa o URL e o Código para encontrar o padrão.
    - *Exemplo:* Se o código é `5512` e o URL é `.../fichas/5512.pdf`, o sistema aprende o padrão `.../fichas/{{ItemCode}}.pdf`.
- **Multi-Target:** O sistema suporta múltiplos padrões por Dossier:
    - **Web Page:** Para extrair texto/specs de uma página HTML.
    - **Direct Image:** Para links diretos de imagens.
    - **PDF Doc:** Para download de fichas técnicas.
    - **3D/CAD:** Para ficheiros técnicos.

### Passo 3: Enriquecimento (Job Execution)
- O sistema aplica os padrões aprendidos a **todas** as linhas do Excel carregado.
- Gera uma lista de URLs candidatos para cada produto.
- Valida a existência desses recursos (verifica se o link dá 404 ou 200 OK).

## 4. Estrutura de Dados (SQLite)

O módulo gere as suas próprias tabelas no SQLite:

1.  **`ce_uploads`**: Registo dos ficheiros Excel carregados.
2.  **`ce_brand_profiles`** (Brand Dossiers):
    - Guarda as regras de extração e padrões de URL (`extraction_rules_json`).
    - Guarda configurações de autenticação (B2B).
3.  **`ce_jobs`**: Guarda o estado das tarefas de enriquecimento (progresso, status).
4.  **`ce_job_items`**: Guarda os resultados linha-a-linha (qual o URL encontrado para cada produto).

## 5. Estrutura de Ficheiros

### Server (`server/src/modules/catalogEnricher/`)
- `index.ts`: Ponto de entrada, regista o módulo na app Express principal.
- `routes/index.ts`: Definição de todos os endpoints da API.
- `services/`:
    - `ceStartModule.ts`: Inicialização da BD e tabelas.
    - `ceProfileService.ts`: Lógica de gestão de perfis e **algoritmo de deteção de padrões**.
    - `ceJobService.ts`: Gestão de filas de trabalho (jobs).
    - `ceExcelService.ts`: Parsing e leitura de ficheiros Excel.
- `db/ceDatabase.ts`: Conexão Singleton ao SQLite.

### Client (`client/src/modules/catalogEnricher/`)
- `api/ceClient.ts`: Cliente HTTP para comunicar com o backend.
- `pages/`:
    - `CeDashboardPage.tsx`: Visão geral.
    - `CeDossiersPage.tsx`: Lista de perfis de marcas.
    - `CeDossierDetailPage.tsx`: Detalhe e edição de um perfil.
- `components/`:
    - `CeDossierEditor.tsx`: Modal complexo de edição e "ensino" dos padrões de URL.

## 6. Algoritmo de Deteção de Padrões
Localizado em `ceProfileService.ts`, este algoritmo é o "cérebro" do módulo:
1.  Recebe um objeto `row` (dados do produto) e um `url` (exemplo real).
2.  Tenta encontrar valores das colunas (ex: Código, Nome, EAN) dentro do URL.
3.  Suporta transformações inteligentes:
    - **Match Exato:** `5512` -> `5512`
    - **Slugify:** `Super Furadeira` -> `super-furadeira`
    - **Lowercase:** `ABS` -> `abs`
4.  Gera um *template* dinâmico (ex: `https://site.com/prod/{{slug(Name)}}.html`) que é guardado e reutilizado.
