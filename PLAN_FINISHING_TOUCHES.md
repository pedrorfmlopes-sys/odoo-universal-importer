# Finalization Plan: The "Catalog Enricher" Endgame

This plan outlines the final steps to transition the Catalog Enricher from a "Working Prototype" to a "Production-Ready Product".

## 1. The Critical Gap: "The Recipe Lab" (Missing Feature)
**Status:** 🔴 CRITICAL MISSING
**Problem:** The User Manual promises "Recipes" to instruct the robot. Currently, the UI only allows selecting "Universal" or pre-seeded recipes. There is **no way** for the user to create a Custom Recipe (e.g., "For `bette.de`, the title is `.h1-product` and code is `#sku`").
**Solution:** Build the **Recipe Editor UI**.

*   **UI:** New Tab `Recipe Lab`.
*   **Features:**
    *   **List:** View all saved recipes.
    *   **Create/Edit:**
        *   Input Name & Domain.
        *   **Visual Selector Input:** Simple form to map fields to CSS Selectors.
            *   `Product Name Selector`: (e.g., `h1.title`)
            *   `Code Selector`: (e.g., `.sku`)
            *   `Image Selector`: (e.g., `.gallery img`)
        *   **JSON Toggle:** For power users to paste complex configurations.
    *   **Test:** Button to "Test Recipe" against a URL (returns the extracted JSON).

## 2. Refine "Web Catalog" (The Warehouse)
**Status:** 🟡 PARTIAL (Read-Only)
**Problem:** Users can view extracted data but cannot clean or use it effectively.
**Solution:** Enhance `CeCatalogPage.tsx`.

*   **Edit Mode:** Allow clicking a row to edit "Product Name" or "Code" (fix typos manually).
*   **Delete/Cleanup:** Select rows -> "Delete" (remove bad extractions).
*   **Asset Gallery:** Add a generic "Media Gallery" to view all downloaded images/PDFs to ensure they are correct.
*   **Export:** Add a simple "Download CSV" button to export the current view.
*   **Onboarding:** Add the "Send to Importer" button (The Bridge) to turn the catalog into a Job for the main Import Wizard.

## 3. The "Odoo Bridge"
**Status:** ⚪ NOT STARTED
**Problem:** The data is stuck in the Enricher.
**Solution:**
*   Create an integration point where "Selected Products" in the Web Catalog can be pushed to the main "Universal Importer" queue, effectively treating the "Web Catalog" as just another file source (like an Excel file).

---

## 📅 Execution Roadmap

### Step 1: The "Recipe Lab" (High Priority)
1.  Create `CeRecipePage.tsx`.
2.  Implement `RecipeEditor` component (Form for CSS Selectors).
3.  Implement `TestScrape` API (Backend: `cePuppeteerService.testScrape(url, recipe)`).

### Step 2: Catalog Enhancements
1.  Add `Delete` button to `CeCatalogPage`.
2.  Add `Edit` modal for products.
3.  Add `Export CSV` button.

### Step 3: Final Integration
1.  Link `Manage Recipes` button in the "Teacher" tab to the new `Recipe Lab`.
2.  Final E2E Test: Create Recipe -> Scan Structure -> Bulk Extract -> Edit Data -> Export.

---
**Ready to execute?** I recommend starting with **Step 1: The Recipe Lab**, as it unlocks the true power of the Crawler for complex sites.
