# IMPLEMENTATION PLAN: CATALOG ENRICHER V2 - SCALABLE ARCHITECTURE

Este plano foi refinado para incorporar robustez empresarial, drivers agnósticos e gestão de estado persistente.

## FASE 0: PREPARAÇÃO DE DADOS & DEPENDÊNCIAS
**Objetivo:** Preparar a base de dados como "Source of Truth" e as abstrações necessárias.

1.  **Dependências**
    *   Instalar `sharp`: Para processamento de imagem.
    *   Instalar `axios`, `cheerio`: HTTP e Parsing leve.
    *   *(Playwright)*: Adiado para Fase 4, preparação via abstração de Drivers.

2.  **Base de Dados (SQLite) - Schema Refinado**
    *   **`ce_assets`**: Tabela central de cache e estado de assets.
        *   `id` (PK)
        *   `asset_key` (UNIQUE): `brand_profile_id` + `product_ref` + `asset_type` + `role` (ex: 'main', 'gallery_1')
        *   `job_id`: Último job que tocou este asset.
        *   `brand_profile_id`, `product_ref`
        *   `asset_type` (image, pdf, cad)
        *   `role` (main, gallery, tech_sheet, manual)
        *   `original_url`
        *   `product_url` (página de origem)
        *   `local_path` (se descarregado)
        *   `http_status` (200, 404, etc.)
        *   `file_hash`, `check_sum` (para dedupe)
        *   `last_checked_at`, `last_seen_at`
        *   `error_log` (texto curto de erro)

3.  **Refactor da Configuração (JSON) no Profile**
    *   Estrutura clara separando descoberta de extração:
        ```json
        {
          "discovery": {
             "strategy": "list_input", // ou "collection_crawl"
             "params": { ... }
          },
          "targets": {
             "images": { 
                "strategy": "cheerio", 
                "rules": { "selector": "meta[property='og:image']", "gallery": ".thumbs img" } 
             },
             "pdf": { 
                "strategy": "pattern", 
                "template": "..." 
             }
          }
        }
        ```

---

## FASE 1: O CORE ENGINE (DRIVER & ASSET MANAGER)
**Objetivo:** Infraestrutura robusta que os adapters vão usar.

1.  **Abstração de Drivers (`/core/drivers`)**
    *   `IDriver`: Interface comum.
    *   `HttpDriver`: Implementação com Axios/Cheerio (Get, Head, Parse).
        *   **Smart Validation**: Implementar `validateLink` com fallback (HEAD -> GET Range:0-0 -> GET Timeout curto).

2.  **Serviço `AssetManager` (`/core/AssetManager.ts`)**
    *   Gestão centralizada de downloads.
    *   Integração com `sharp` para resize/convert (ex: gerar thumbnails para Odoo).
    *   Lógica de "Cache Hit": Antes de baixar, verificar `ce_assets` por `file_hash` ou `last_checked_at` recente.

3.  **Logs e Persistência**
    *   O Sistema de Jobs deixa de escrever em ficheiros temporários.
    *   Escreve tudo na DB (`ce_job_items`, `ce_assets`).
    *   **Export On-Demand**: Endpoint que consulta a DB e gera o CSV/XLSX atualizado (garante idempotência).

---

## FASE 2: ARQUITETURA DE ADAPTERS
**Objetivo:** Criar os "plugins" por marca.

1.  **Interface `IBrandAdapter`**
    ```typescript
    interface IBrandAdapter {
        // Fase 1: Encontrar URLs de produtos
        discover(scope: JobScope): AsyncGenerator<ProductItem>; 
        
        // Fase 2: Extrair assets de um produto
        extract(product: ProductItem, driver: IDriver): Promise<ExtractedAsset[]>;
    }
    ```

2.  **Adapter `PatternAdapter` (Migração)**
    *   Portar a lógica atual para dentro desta estrutura, usando o `HttpDriver` (apenas para validação, já que a descoberta é por regex).

3.  **Orquestrador de Jobs V2**
    *   Pipeline simplificado: 
        `Discover` -> `Buffer/Queue` -> `Extract (Parallelized)` -> `AssetManager (Download/Save)` -> `DB`.

---

## FASE 3: PRIMEIRO ADAPTER "REAL" (SCARABEO)
**Objetivo:** Validar a arquitetura com scraping real mas leve (sem browser).

1.  **Adapter `ScarabeoAdapter`**
    *   **Discovery**: Lista de códigos do Excel.
    *   **Extraction (Images)**:
        *   Usar `HttpDriver` para obter HTML.
        *   Ler `og:image` (imagem principal).
        *   Procurar `div.gallery a` ou `img[data-src]` para galeria, filtrando placeholders.
    *   **Extraction (PDF)**: Manter lógica de padrão URL (muito eficiente para Scarabeo).

2.  **Integração na UI**
    *   Adicionar opções ao "Job Launch Modal": 
        *   [x] Download Assets
        *   [x] Validar Links (Deep Check)
        *   [x] Resize (Max 1200px)

---

## FASE 4: INTEGRAÇÃO PLAYWRIGHT (FUTURO - RITMONIO/BETTE)
**Objetivo:** Suportar sites SPA/Dinâmicos via `BrowserDriver`.

1.  **Driver `BrowserDriver`**
    *   Implementa `IDriver` mas usa Playwright internamente.
    *   Permite `page.evaluate`, `page.waitForSelector`.
    *   Permite interceção de Network (XHR) para apanhar JSONs de API escondidos.

2.  **Adapter Bette/Ritmonio**
    *   Usa `BrowserDriver` para renderizar o JS antes de extrair.

---

## CHECKLIST DE VALIDAÇÃO
- [ ] O sistema atual de Cards continua a funcionar sem regressão?
- [ ] Consigo retomar um job interrompido sem duplicar linhas no report final?
- [ ] Os downloads não bloqueiam a thread principal do Node? (Streams/Worker threads se necessário).
- [ ] A validação de links lida bem com 405/403 (False Negatives)?
