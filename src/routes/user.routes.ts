import { Router } from "express";
import {
  createPassword,
  getProfile,
  getUsers,
  login,
  signUpWithEmail,
  signUpWithPhoneNumber,
  updateProfile,
} from "../controllers/user.controller";

const router = Router();

router.get("/", getUsers);
router.get("/me", getProfile);
router.post("/signUpWithEmail", signUpWithEmail);
router.post("/signUpWithPhoneNumber", signUpWithPhoneNumber);
router.post("/createPassword", createPassword);
router.post("/login", login);
router.post("/profile", updateProfile);

export default router;
