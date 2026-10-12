import express from "express";
import { getCurrentUser, login, register, logout } from "../Controller/authControllers.js";
import { optionalAuthMiddleware } from "../middlesware/authMiddlesware.js";

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.post("/logout", logout);
router.get("/me", optionalAuthMiddleware, getCurrentUser);

export default router;
