
import { Request, Response } from 'express';
import { CredentialService } from '../services/ceCredentialService';

const service = new CredentialService();

export const getCredentials = (req: Request, res: Response) => {
    try {
        const items = service.getAll();
        res.json(items);
    } catch (e: any) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
};

export const createCredential = (req: Request, res: Response) => {
    try {
        const item = service.create(req.body);
        res.json(item);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
};

export const updateCredential = (req: Request, res: Response) => {
    try {
        const item = service.update(req.params.id, req.body);
        res.json(item);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
};

export const deleteCredential = (req: Request, res: Response) => {
    try {
        const result = service.delete(req.params.id);
        res.json(result);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
};

export const revealCredential = (req: Request, res: Response) => {
    try {
        const item = service.getDecrypted(req.params.id);
        if (!item) return res.status(404).json({ error: "Not found" });
        res.json({ password: item.password });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
};
