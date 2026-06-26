import { Router } from "express";
import { getStreamToken } from "../controllers/stream.controller";

const router = Router();

router.get("/token", getStreamToken);

export default router;
