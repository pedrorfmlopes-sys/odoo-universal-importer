# Plano de Implementação: Catalog Enricher V2 - "Smart Brand Dossiers"

Este documento detalha a evolução do Catalog Enricher para um sistema inteligente baseado em aprendizagem por exemplo e perfis de marca reutilizáveis.

## 1. Conceito Central: "Brand Dossiers" (Dossiers de Marca)

Em vez de configurações descartáveis por job, criamos a entidade **"Brand Profile"** (Dossier).
Este perfil armazena o "Know-How" de como extrair dados de um site/fornecedor específico.

### Estrutura do Dossier:
*   **Nome:** (ex: "Bosch PT", "Fornecedor X")
*   **Domínio Base:** (ex: `https://catalogo-bosch.com`)
*   **Autenticação:** (Credenciais se o site for fechado)
*   **Fórmula de URL:** O padrão inteligente para construir links.
*   **Regras de Extração:** Onde estão as Imagens, PDFs, Preços.
*   **Histórico:** Lista de Jobs/Uploads feitos com este perfil.

---

## 2. Funcionalidade Estrela: "Teach by Example" (URL Reverse Engineering)

O utilizador não deve ter de programar fórmulas complexas.

**Workflow:**
1.  **Upload:** Utilizador carrega Excel.
2.  **Calibração:**
    *   O Sistema apresenta uma linha aleatória do Excel (ex: Row 5).
    *   Mostra: `ItemCode: 99881`, `Name: Berbequim XP`.
    *   Pergunta: **"Por favor, introduz o Link Real funcional para este produto específico."**
3.  **Dedução Automática (IA/Algoritmo):**
    *   O Utilizador cola: `https://site.com/pt/ferramentas/berbequim-xp-99881.html`
    *   O Sistema analisa e propõe o Padrão: `https://site.com/pt/ferramentas/{slug(Name)}-{ItemCode}.html`
4.  **Validação:** O sistema testa esse padrão em mais 3 linhas aleatórias e pergunta ao utilizador se os links gerados funcionam.
5.  **Gravação:** O padrão fica salvo no Dossier.

---

## 3. Arquitetura Técnica

### A. Base de Dados (Novas Tabelas)

```sql
CREATE TABLE ce_brand_profiles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    domain_root TEXT,
    
    -- Autenticação
    auth_required BOOLEAN DEFAULT 0,
    auth_login_url TEXT,
    auth_user TEXT, -- Encrypted at app level
    auth_pass TEXT, -- Encrypted at app level
    
    -- Inteligência de URL
    url_pattern_template TEXT, -- ex: "https://site.com/p/{{column_B}}-{{slug(column_C)}}"
    
    -- Regras de Extração (JSON)
    extraction_rules_json TEXT, 
    -- Ex: { "image": ".main-gallery img", "pdf": "a[href$='.pdf']" }
    
    created_at TEXT
);

-- Ligar Jobs a Profiles
ALTER TABLE ce_jobs ADD COLUMN profile_id TEXT REFERENCES ce_brand_profiles(id);
```

### B. Autenticação (Login B2B)

Para sites que requerem login, o `axios/cheerio` simples não serve.
*   **Solução:** Integração com **Puppeteer** (Headless Chrome).
*   **Fluxo:**
    1.  Antes do Job começar, o Worker abre o browser (invisível).
    2.  Vai à pagina de login.
    3.  Preenche User/Pass do Dossier.
    4.  Guarda os Cookies de Sessão.
    5.  Usa esses cookies para fazer os requests rápidos das 5000 linhas.

---

## 4. UI/UX (Frontend)

### Novo Painel "Brand Manager"
*   Lista de Marcas criadas.
*   Botão "Create New Brand".
*   Editor visual de regras.

### Wizard Atualizado
*   **Passo 1:** Upload Excel.
*   **Passo 2:** "Selecionar Marca/Dossier" (Existente ou Criar Nova).
*   **Passo 3 (Se Criar Nova):**
    *   Inputs de Login (opcional).
    *   **Assistente de "Teach URL":**
        *   Mostra dados da Linha 1.
        *   Input para colar URL Real.
        *   Botão "Detectar Padrão".
*   **Passo 4:** Executar.

---

## 5. Roteiro de Desenvolvimento (Phased Roadmap)

### Fase 1: Gestão de Perfis e Ensino de URL (Prioridade)
*   [ ] Criar tabela `ce_brand_profiles`.
*   [ ] Frontend: Página de Gestão de Marcas.
*   [ ] Backend: Algoritmo de "Reverse Pattern Matching" (Descobrir que `A123` no link vem da coluna `Ref`).
*   [ ] Integrar no Wizard.

### Fase 2: Regras de Extração (Assets)
*   [ ] UI para definir seletores CSS (ou usar IA para descobrir).
*   [ ] Backend: Guardar imagens e PDFs baixados vinculados ao produto.

### Fase 3: Autenticação (Puppeteer)
*   [ ] Implementar worker com Browser real para login.
*   [ ] Seg e gestão de sessão.

---

Este plano coloca o poder nas mãos da IA e retira o trabalho manual do utilizador, permitindo a construção de uma base de conhecimento (Dossiers) que valoriza com o tempo.
