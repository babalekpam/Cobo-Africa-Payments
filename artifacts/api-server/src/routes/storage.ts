import { Router, type IRouter, type Request, type Response } from "express";
import { Readable } from "stream";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

router.post("/storage/uploads/request-url", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { name, size, contentType } = req.body;
  if (!name || !contentType) {
    res.status(400).json({ error: "name and contentType required" });
    return;
  }

  try {
    const uploadURL = await objectStorageService.getObjectEntityUploadURL();
    const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);

    res.json({ uploadURL, objectPath });
  } catch (err: any) {
    console.error("[STORAGE] presigned URL error:", err.message);
    res.status(500).json({ error: "Failed to generate upload URL" });
  }
});

router.get("/storage/public-objects/*path", async (req: Request, res: Response) => {
  const filePath = req.params.path;
  if (!filePath) {
    res.status(400).json({ error: "File path is required" });
    return;
  }

  try {
    const file = await objectStorageService.searchPublicObject(filePath);
    if (!file) {
      res.status(404).json({ error: "Object not found" });
      return;
    }
    const response = await objectStorageService.downloadObject(file);
    const contentType = response.headers.get("content-type") || "application/octet-stream";
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=3600");
    if (response.body) {
      const readable = Readable.fromWeb(response.body as any);
      readable.pipe(res);
    } else {
      res.status(404).json({ error: "Empty response" });
    }
  } catch {
    res.status(404).json({ error: "Object not found" });
  }
});

router.get("/storage/objects/*path", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const objectPath = "/objects/" + req.params.path;

  try {
    const file = await objectStorageService.getObjectEntityFile(objectPath);
    const response = await objectStorageService.downloadObject(file);
    const contentType = response.headers.get("content-type") || "application/octet-stream";
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "private, max-age=300");
    if (response.body) {
      const readable = Readable.fromWeb(response.body as any);
      readable.pipe(res);
    } else {
      res.status(404).json({ error: "Empty response" });
    }
  } catch (err) {
    if (err instanceof ObjectNotFoundError) {
      res.status(404).json({ error: "Object not found" });
    } else {
      res.status(500).json({ error: "Failed to retrieve object" });
    }
  }
});

export default router;
