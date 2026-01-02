# Plano de Implementação: Integração Estrutura de Site & Crawler

Este documento detalha o roteiro para transformar a "Árvore de Categorias" (já implementada) no motor de alimentação do "Robot de Extração" (Crawler).

## Estado Atual
✅ **Teacher Mode (Robot)**: Cria receitas de extração (seletores CSS para Nome, Imagem, etc).
✅ **Site Structure (Scanner)**: Cria a árvore de URLs das categorias do site via AI.
❌ **Ligação**: Não existe forma de dizer "Usa a receita X para extrair todos os produtos das categorias Y e Z da árvore".

---

## Fase 1: Interface de Seleção e Disparo (Frontend)
**Objetivo:** Permitir ao utilizador selecionar categorias da árvore e iniciar o trabalho em massa.

1.  **Atualizar `CeTeacherTab.tsx` (Aba Structure)**:
    *   Adicionar **Checkboxes** na `RecursiveTree` para permitir seleção múltipla de categorias.
    *   Adicionar um **Dropdown de Receitas** ao lado do botão de "Scan/Save". O utilizador deve escolher *qual* receita (perfil de extração) usar nessas categorias.
    *   Criar botão **"Iniciar Extração em Massa"**.

2.  **Fluxo de Dados**:
    *   Ao clicar "Iniciar", o frontend envia para o backend:
        *   `profileId` (Site/Marca)
        *   `recipeId` (Como extrair)
        *   `targetUrls` (Lista de URLs das categorias selecionadas)

---

## Fase 2: Motor de Crawling "Smart Queue" (Backend)
**Objetivo:** Processar múltiplos URLs de categorias sem bloquear o servidor ou ser bloqueado pelo site.

1.  **Novo Serviço: `ceQueueService.ts`**:
    *   Implementar uma fila (Queue) baseada em `p-queue` (já instalada).
    *   Controlar concorrência (ex: 2 abas em paralelo máx).

2.  **Atualizar `ceCrawlerService.ts`**:
    *   Criar método `processCategoryBatch(recipeId, categoryUrls)`.
    *   **Lógica de Navegação**:
        *   Para cada URL de Categoria:
            1.  Navegar.
            2.  Detetar Links de Produtos (`a.href` que batem com o padrão da receita ou heurística).
            3.  (Opcional) Lidar com Paginação (Botão "Next").
            4.  Adicionar Links de Produtos encontrados a uma "Fila de Produtos".

3.  **Processamento de Produtos**:
    *   O Crawler consome a "Fila de Produtos".
    *   Abre cada produto e aplica a **Receita** (extrai Nome, SKU, Imagens, PDFs).
    *   Grava na tabela `ce_web_products` com referência à Categoria da Taxonomia.

---

## Fase 3: Mapeamento de Categorias Odoo (Backend & Frontend)
**Objetivo:** Converter a taxonomia "Sujo" (do Site) para a taxonomia "Limpa" (do Odoo).

1.  **Backend**:
    *   Atualizar tabela `ce_taxonomy` para ter coluna `odoo_category_id` (Relational).
    *   Criar endpoint `PUT /taxonomy/map` para salvar associações.

2.  **Frontend (Nova Aba ou Modal)**:
    *   Interface "De -> Para".
    *   Coluna Esquerda: Árvore do Site.
    *   Coluna Direita: Dropdown de Categorias Odoo (Searchable).
    *   Botão "Auto-Map" (AI tenta adivinhar pelo nome: "Washbasins" -> "Lavatórios").

---

## Fase 4: Exportação Final
**Objetivo:** Criar os registos finais no Odoo.

1.  **Export Service**:
    *   Ler `ce_web_products`.
    *   Agrupar por `sku` (evitar duplicados).
    *   Usar o mapeamento da Fase 3 para definir a categoria final.
    *   Gerar CSV/Excel final ou injetar diretamente no Odoo.

## Cronograma Sugerido

| Passo | Tarefa | Complexidade |
| :--- | :--- | :--- |
| **1.** | Checkboxes na Árvore + Botão "Iniciar" | Baixa |
| **2.** | Backend Queue (Fila de Categorias) | Média |
| **3.** | Lógica de "Encontrar Produtos na Categoria" | Alta |
| **4.** | Mapeamento Odoo (De->Para) | Média |
