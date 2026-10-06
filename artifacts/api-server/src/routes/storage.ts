import express, { Router, type IRouter, type Request, type Response } from "express";
import { createLocalUploadURL, localStorageEnabled, openLocalObject, saveLocalUpload } from "../lib/localObjectStore";
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

  if (localStorageEnabled()) {
    try {
      res.json(createLocalUploadURL(String(contentType)));
    } catch {
      res.status(400).json({ error: "Unsupported content type. Use JPEG, PNG, WebP or PDF." });
    }
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

// Local-disk backend: the signed, single-use, 15-minute upload URL handed out by request-url /
// kyc/upload-url. No login is needed on this PUT — the signed token is the capability.
router.put("/storage/local-upload/:token", express.raw({ type: () => true, limit: "10mb" }), async (req: Request, res: Response) => {
  if (!localStorageEnabled()) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const body = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
  const result = await saveLocalUpload(String(req.params.token), req.headers["content-type"], body);
  const status = { ok: 200, bad_token: 403, type_mismatch: 415, too_large: 413, bad_content: 415, already_uploaded: 409 }[result];
  res.status(status).json(result === "ok" ? { success: true } : { success: false, error: result });
});

router.get("/storage/objects/*path", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  if (localStorageEnabled()) {
    const rel = ([] as string[]).concat(req.params.path as string | string[]).join("/");
    const id = /^uploads\/([^/]+)$/.exec(rel)?.[1];
    const obj = id ? await openLocalObject(id) : null;
    if (!obj) {
      res.status(404).json({ error: "Object not found" });
      return;
    }
    res.setHeader("Content-Type", obj.contentType);
    res.setHeader("Content-Length", String(obj.size));
    res.setHeader("Cache-Control", "private, max-age=300");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Security-Policy", "sandbox; default-src 'none'");
    obj.stream.pipe(res);
    return;
  }

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
