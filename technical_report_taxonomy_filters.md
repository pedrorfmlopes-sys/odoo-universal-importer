
# Relatório Técnico: Adaptação Filtros vs Taxonomia (Bette Project)

Este documento detalha os pontos de intervenção no código atual para implementar a lógica de detecção de *Facets/Filtros* baseada em "Overlap de Produtos", sem reescritas profundas.

## 1. Construção da Árvore (Node Building)
*   **Ficheiro:** `server/src/modules/catalogEnricher/services/ceAiService.ts`
*   **Função Principal:** `scanStructure` (Entry point) -> `processNode` (Recursiva).
*   **Prompt AI:** Método `callAiScan`.
*   **Estrutura do Nó (JSON):**
    ```json
    {
      "name": "Nome da Categoria",
      "url": "https://...",
      "type": "category",
      "children": []
    }
    ```
    *Sugestão:* Adicionar propriedade `visited_products_count` ou `node_kind` ('category' | 'facet') aqui após análise.

## 2. Decisão "Subcategoria vs Produto/Lista"
*   **Ficheiro:** `server/src/modules/catalogEnricher/services/cePuppeteerService.ts`
*   **Função:** `analyzePage(url)`
*   **Lógica de Classificação (`page_kind`):**
    *   `products.length >= 6` -> **product_list**
    *   `products.length === 0` AND `subcats.length >= 3` -> **category_hub**
    *   Regex overrides: `/collection|series/` -> **collection_hub**
*   **Intervenção:** É aqui que extraímos a lista bruta de `product_family_urls_found` que será usada para o cálculo de *Overlap*.

## 3. Início do Bulk Extraction (Job Runner)
*   **Ficheiro:** `server/src/modules/catalogEnricher/services/ceQueueService.ts`
*   **Função:** `addBulkTask`
*   **Estado Atual:**
    *   Itera sobre todos os nós selecionados na UI.
    *   Não valida se URLs diferentes apontam para o mesmo conteúdo (exceto `ON CONFLICT` na DB).
*   **Intervenção:** Adicionar um passo de pré-processamento/deduplicação que verifica se um nó é apenas um filtro de outro já visitado (High Overlap), ignorando-o se `ignore_facets=true`.

## 4. Extração de URLs de Produto (Harvesting)
*   **Ficheiro:** `server/src/modules/catalogEnricher/services/cePuppeteerService.ts`
*   **Função:** `analyzePage` (Bloco "Harvest Data" dentro do `page.evaluate`).
*   **Output:** `metadata.product_family_urls_found` (Array de strings).
*   **Limpeza:**
    *   Remove hash (`#`).
    *   Remove query params agressivos, mantendo apenas paginação (`?page=`, `?p=`).
    *   *Nota:* Para detecção de filtros, esta limpeza é boa, pois queremos comparar o produto "canónico".

## 5. Breadcrumb Parsing (Caminho Hierárquico)
*   **Status Atual:** ❌ **Não Implementado**.
*   Nenhuma função extrai ou armazena o breadcrumb estruturado. A hierarquia é inferida apenas pela estrutura pai/filho da árvore de navegação descoberta.

## 6. Exemplos Reais (Bette - Test Cases)
Para validar a heurística de Overlap (Jaccard Index):

*   **Caso A: Categoria Pai (Base)**
    *   URL: `https://www.my-bette.com/es/productos/lavabos`
    *   Expectativa: Lista mista de lavabos (Murais, Encastre, etc.).

*   **Caso B: Subcategoria Real (Low Overlap)**
    *   URL: `https://www.my-bette.com/es/productos/lavabos/lavabos-murales`
    *   Expectativa: Contém apenas um subconjunto específico. O Overlap com o índice global da categoria pai é < 100% (é um subset), mas o Overlap com uma subcategoria "irmã" (ex: Encastre) deve ser ~0%.

*   **Caso C: Faceta/Filtro (High Overlap - Simulação)**
    *   Se existir: `.../lavabos-murales?color=white`
    *   Expectativa: Retorna quase os mesmos produtos de `.../lavabos-murales`, apenas menos quantidade.
    *   **Lógica Overlap:** `Intersection(A, B) / Union(A, B)`. Se > 0.8, é provável faceta. Se isSubset(B, A) e A.size >> B.size, é filtro.

---
*Gerado por Antigravity AI - 2025-12-22*
