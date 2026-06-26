import { Router } from "express";
import { getConversationMessages } from "../controllers/message.controller";

const router = Router();

router.get("/:userId", getConversationMessages);

export default router;
