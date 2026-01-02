# Catalog Enricher V3: The Product Intelligence Platform
> From "File Processor" to "Autonomous Data Warehouse"

This document outlines the roadmap for transforming the Catalog Enricher into a generic, powerful "Super App" for e-commerce data extraction, management, and synchronization (Odoo).

## 🏗️ Architecture Overview

The system evolves into three distinct pipelines:
1.  **Acquisition (The Robot):** Universal crawling and extraction.
2.  **Refinery (The Brain):** Data cleaning, translation, and enrichment (AI).
3.  **Distribution (The Bridge):** Synchronization with Odoo and ERPs.

---

## 📅 Phased Implementation Plan

### Phase 1: The "Command Center" (Data Management)
**Goal:** Visualize, query, and manage the extracted data deeply.

1.  **Catalog Explorer UI**
    *   Implement a high-performance Data Grid (e.g., TanStack Table or AG Grid).
    *   **Features:**
        *   View the `ce_web_products` inventory.
        *   Filter/Sort by "Missing Code", "Has Image", "Date Crawled".
        *   Inline Editing (fix typos manually).
        *   Bulk Actions (Delete selected, Reprocess selected).

2.  **Data Health Tools**
    *   **Deduplication Engine:** Identify duplicates by Name or URL and merge them.
    *   **Missing Product Manager:** Visual interface for the `ce_missing_products` table implies re-crawling specific targets.

### Phase 2: The "Universal Robot" (Generic Crawler UI)
**Goal:** Configure extraction for ANY brand without coding.

1.  **Mission Configurator**
    *   UI to create "Brand Profiles" with:
        *   **Entry Points:** Homepage, Category Roots.
        *   **Whitelists/Blacklists:** "Ignore /blog/", "Only follow /shop/".
    
2.  **Visual Selector Builder (The "Mini-Clone")**
    *   **AI Auto-Detect:** Input a Product URL -> AI analyzes HTML -> Returns CSS selectors for Name, Image, Code.
    *   **Manual Mode:** Define CSS selectors manually via UI inputs (`.product-title`, `.price`).
    *   **Resource Picker:** Select what to fetch: Images, PDFs, CADs, Tech Specs.

### Phase 3: The "Refinery" (Enrichment & Translation)
**Goal:** Add value to raw data using AI and Logic.

1.  **Auto-Translation Module**
    *   Integration with Translation APIs (DeepL / OpenAI).
    *   **Field Mapping:** Translate `description_en` -> `description_pt`.
    *   **Dictionary enforcement:** Ensure technical terms are translated correctly (e.g., "Basin" -> "Lavatório").

2.  **Attribute Extraction (AI)**
    *   Parse unstructured description text to extract structured data:
        *   "Dimensions: 60x40" -> `width: 60`, `depth: 40`.
        *   "Weight: 15kg" -> `weight: 15`.

### Phase 4: The "Bridge" (Odoo Sync)
**Goal:** Push clean, validated data to Odoo autonomously.

1.  **Odoo Connector Settings**
    *   Configure URL, DB, User, API Key.
    *   Test Connection.

2.  **Staging & Validation Area**
    *   **The "Diff" View:** Compare Local vs Odoo data.
    *   **Safety Checks:**
        *   "Product 5204 exists in Odoo. Update?"
        *   "Category 'Mirrors' missing in Odoo. Create?"
    
3.  **Sync Engine**
    *   **Create:** Push completely new products.
    *   **Update:** Smart patch existing products (e.g., only update Images, keep stock untouched).
    *   **Image Upload:** Robust upload of assets to Odoo attachments.

---

## 🚀 Immediate Next Steps (Starting Phase 1)

1.  **Create `CeCatalogPage.tsx`**: A new main tab in the application for "Web Catalog".
2.  **Setup API Endpoints**:
    *   `GET /api/ce/catalog`: List crawled products with pagination/filtering.
    *   `POST /api/ce/catalog/dedupe`: Run deduplication logic.
3.  **Connect UI to `ce_web_products`**: Display the Scarabeo data we just mined.
