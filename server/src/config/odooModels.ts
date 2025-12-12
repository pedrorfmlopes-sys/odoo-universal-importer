
export type MacroId = "commercial" | "sales_crm" | "purchasing_inventory" | "projects_services" | "accounting" | "hr" | "other";

export interface OdooEntityConfig {
    id: string; // Unique identifier for the entity (e.g., 'products')
    label: string; // Display name
    model: string; // Odoo technical model name (e.g., 'product.template')
    subgroup?: string; // Optional grouping within the macro
}

export interface MacroConfig {
    id: MacroId;
    label: string; // Display name for the macro/area
    description?: string;
    entities: OdooEntityConfig[];
}

/**
 * High-level configuration of Odoo areas (Macros).
 * This defines the hierarchy for the frontend selection.
 */
export const ODOO_MACROS: MacroConfig[] = [
    {
        id: "commercial",
        label: "Comercial",
        description: "Products, Attributes, and Partners",
        entities: [
            { id: "products", label: "Produtos", model: "product.template" },
            { id: "partners", label: "Contatos / Clientes", model: "res.partner" },
            { id: "attributes", label: "Atributos de Produto", model: "product.attribute" },
            { id: "attribute_values", label: "Valores de Atributo", model: "product.attribute.value" },
        ]
    },
    {
        id: "sales_crm",
        label: "Vendas & CRM",
        description: "Leads, Opportunities, and Sale Orders",
        entities: [
            { id: "leads", label: "Leads/Oportunidades", model: "crm.lead" },
            { id: "sale_orders", label: "Pedidos de Venda", model: "sale.order" },
        ]
    },
    {
        id: "purchasing_inventory",
        label: "Compras & Inventário",
        description: "Purchase Orders and Stock",
        entities: [
            { id: "purchase_orders", label: "Pedidos de Compra", model: "purchase.order" },
        ]
    },
    {
        id: "projects_services",
        label: "Projetos & Serviços",
        entities: [
            // Stubs for future expansion
            // { id: "projects", label: "Projetos", model: "project.project" } 
        ]
    },
    {
        id: "accounting",
        label: "Contabilidade",
        entities: []
    },
    {
        id: "hr",
        label: "Recursos Humanos",
        entities: []
    },
    {
        id: "other",
        label: "Outros",
        entities: []
    }
];

/**
 * Flat list of all supported models for backwards compatibility and easy lookup.
 * Derived automatically from ODOO_MACROS.
 */
export const ODOO_MODELS = ODOO_MACROS.flatMap(macro =>
    macro.entities.map(entity => ({
        ...entity,
        macroId: macro.id,
        macroLabel: macro.label
    }))
);

