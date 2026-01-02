import { Request, Response } from 'express';
import { ceAssetService } from '../services/ceAssetService';

export const ceAssetController = {
    downloadMissingAssets: async (req: Request, res: Response) => {
        try {
            const { brandProfileId, assetTypes } = req.body;

            if (!brandProfileId) {
                return res.status(400).json({ error: "brandProfileId is required" });
            }

            // Launch Async or Await? 
            // For now, let's await to give immediate feedback, but realistically this should be async job.
            // Given the user wants a specific function "login then download all", let's keep it simple.

            const result = await ceAssetService.downloadMissingAssets(brandProfileId, assetTypes);

            res.json({
                success: true,
                message: `Download complete. Processed: ${result.downloadCount}, Errors: ${result.errorCount}`,
                stats: result
            });

        } catch (e: any) {
            console.error("Asset Download API Failed", e);
            res.status(500).json({ error: e.message });
        }
    }
};
