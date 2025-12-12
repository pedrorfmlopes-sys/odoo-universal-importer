import axios from 'axios';
import { OdooConfig, OdooFieldMeta } from './types';


export class OdooClient {
    private config: OdooConfig;

    constructor(config: OdooConfig) {
        this.config = config;
    }

    private async jsonRpc<T>(service: string, method: string, args: any[]): Promise<T> {
        const url = `${this.config.url}/jsonrpc`;
        const payload = {
            jsonrpc: "2.0",
            method: "call",
            params: {
                service,
                method,
                args,
            },
            id: Math.floor(Math.random() * 1000000000),
        };

        try {
            const response = await axios.post(url, payload);
            if (response.data.error) {
                throw new Error(JSON.stringify(response.data.error));
            }
            return response.data.result;
        } catch (error: any) {
            if (error.response) {
                throw new Error(`Odoo Request Failed: ${error.response.status} ${error.response.statusText}`);
            }
            throw error;
        }
    }

    /**
     * Generic execute_kw wrapper is handled by execute() below.
     * We keep the class clean.
     */


    private uid: number | null = null;

    /**
     * Authenticates with Odoo to get the User ID (UID).
     * This is required for most subsequent calls to the 'object' service.
     * We cache the UID in the instance to avoid re-authenticating on every call.
     */
    private async getUid(): Promise<number> {
        if (this.uid !== null) {
            return this.uid;
        }

        // The 'common' service's 'authenticate' method takes (db, login, password, user_agent_env).
        // It returns the user ID (an integer) if successful, or false/null if failed.
        const uid = await this.jsonRpc<number | false>("common", "authenticate", [
            this.config.db,
            this.config.userEmail,
            this.config.apiKey,
            {}
        ]);

        if (!uid) {
            throw new Error("Authentication failed: Invalid credentials");
        }

        this.uid = uid;
        return uid;
    }

    async execute(model: string, method: string, args: any[] = [], kwargs: any = {}): Promise<any> {
        // Ensure we are authenticated
        const uid = await this.getUid();

        // Execute the method on the model
        return this.jsonRpc("object", "execute_kw", [
            this.config.db,
            uid,
            this.config.apiKey,
            model,
            method,
            args,
            kwargs
        ]);
    }


    async listFields(model: string, attributes?: string[]): Promise<Record<string, any>> {
        // Default attributes if not provided
        const attrs = attributes || ['string', 'help', 'type', 'required', 'selection', 'relation'];
        return this.execute(model, 'fields_get', [], {
            attributes: attrs
        });
    }


    async searchRead(model: string, domain: any[], fields: string[], limit: number = 0): Promise<any[]> {
        return this.execute(model, 'search_read', [domain], {
            fields,
            limit
        });
    }

    async create(model: string, values: any): Promise<number> {
        return this.execute(model, 'create', [values]);
    }

    async write(model: string, ids: number[], values: any): Promise<boolean> {
        return this.execute(model, 'write', [ids, values]);
    }

    async search(model: string, domain: any[]): Promise<number[]> {
        return this.execute(model, 'search', [domain]);
    }
}
