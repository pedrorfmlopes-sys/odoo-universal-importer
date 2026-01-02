# Plano de Implementação: Catalog Enricher (Módulo para Odoo Importer)

Este documento descreve a arquitetura e as fases de implementação do módulo **Catalog Enricher** dentro do Odoo Importer. Este módulo visa enriquecer linhas de Excel com imagens, fichas técnicas e outros assets obtidos por scraping e (opcionalmente) IA.

## Princípios Fundamentais
*   **Isolamento Lógico:** Rotas próprias (`/api/catalog-enricher`), tabelas próprias (prefixo `ce_`), storage próprio (`./data/catalog-enricher`).
*   **Integração UI:** Item na sidebar e rota React, mas com contexto isolado.
*   **Independência:** Sem chamadas ao Odoo por defeito. Ponte opcional apenas para credenciais.

---

## Fase 0: Estrutura e "Barreira de Dependências"
**Objetivo:** Montar o esqueleto e garantir que nada do módulo contamina o importador principal.

1.  **Backend (`server/src/modules/catalogEnricher/`)**
    *   `index.ts` → `mountCatalogEnricher(app)`
    *   `config/`, `db/` (SQLite `catalog.db` com tabelas `ce_*`), `routes/`
    *   `services/` (probe, scrape, ai, jobs, export)

2.  **Frontend (`client/src/modules/catalogEnricher/`)**
    *   `pages/` (Wizard, Jobs, Profiles)
    *   `components/`
    *   `api/ceClient.ts`
    *   `state/`

3.  **Shared (`shared/src/catalogEnricher/`)**
    *   Tipos partilhados (DTOs, Enums).

---

## Fase 1: Dados e Storage (Persistência)
**Objetivo:** Rastreabilidade, preview e repetição.

1.  **Base de Dados (SQLite Isolada: `data/catalog-enricher/catalog.db`)**
    *   **Tabelas:**
        *   `ce_uploads`: Metadados do ficheiro original.
        *   `ce_jobs`: Estado, progresso, parâmetros.
        *   `ce_job_items`: Linhas individuais, resultados, status, confiança.
        *   `ce_site_profiles`: Conhecimento acumulado (regras, seletores) por domínio ("Learn Once").
        *   `ce_executions`: Histórico para diffs/updates.

2.  **File Storage (`data/catalog-enricher/`)**
    *   `uploads/<uploadId>/`
    *   `assets/<domain>/<ref>/`

---

## Fase 2: Motor de Jobs (Execução Previsível)
**Objetivo:** Processamento assíncrono robusto.

1.  **Modelo MVP (In-Process):**
    *   Uso de `p-queue` para controlo de concorrência.
    *   Retries automáticos.
    *   Estado persistido na DB a cada passo.

2.  **Jobs:**
    *   `analyze`: Probe + Sample.
    *   `run_enrich`: Execução completa.
    *   `run_update`: Diff contra execução anterior.

---

## Fase 3: Scraper (Probe + Estratégias)
**Objetivo:** Resultados determinísticos sempre que possível.

1.  **Probe:**
    *   Verifica acesso (bloqueado/ok) e rendering (estático/JS).
2.  **Fetchers:**
    *   `cheerio` (rápido/estático).
    *   `playwright` (se necessário para JS - futuro).
3.  **Estratégias:**
    *   `downloads_map`: Mapeia página de downloads.
    *   `product_crawl`: Navega listagens.
4.  **Evidência:**
    *   Guardar snippet HTML e seletor onde o dado foi encontrado para auditoria.

---

## Fase 4: IA (Learn Mode)
**Objetivo:** Descoberta de regras, baixo custo.

1.  **Modos:**
    *   `AI_MODE=learn` (Default): IA analisa amostra e gera `ce_site_profile`. O job completo corre sem IA usando o perfil gerado.
    *   `AI_MODE=assist`: IA intervém apenas se falha > X%.

2.  **Output:**
    *   Regras e seletores JSON para guardar em `ce_site_profiles`.

---

## Fase 5: API do Módulo
*   `POST /upload`, `GET /health`
*   `POST /analyze` (cria sample job)
*   `POST /run` (cria full job)
*   `GET /jobs/:id` (polling progresso)
*   `POST /export` (Excel/ZIP)
*   `GET /site-profiles`

---

## Fase 6: Frontend (Wizard)
1.  **Sidebar:** Novo item "Catálogo".
2.  **Fluxo:**
    *   Upload -> Mapear (Ref/Url) -> Analyze (Preview Grid) -> Validar/Guardar Profile -> Run -> Export.

---

## Fase 7: Update/Diff
*   Cálculo de Hash dos inputs.
*   Comparação: Novos, Descontinuados, Alterados.
*   Relatórios Delta.

---

## Cronograma Estimado
1.  **Estrutura & DB (Fase 0/1):** 1 dia.
2.  **Job Engine & Probe (Fase 2/3):** 2 dias.
3.  **UI Wizard & Upload (Fase 5/6):** 2 dias.
4.  **AI & Profiles (Fase 4):** 2 dias.
5.  **Refinamento:** 1 dia.
