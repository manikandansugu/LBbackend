import { Router } from "express";
import { getCallHistory } from "../controllers/call.controller";

const router = Router();

router.get("/history", getCallHistory);

export default router;
