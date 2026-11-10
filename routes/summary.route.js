import express from "express";
import { getSummary, getProfit } from "../controllers/summary.controller.js";
import { verifyToken } from "../middlewares/auth.js";
const router = express.Router();

router.get("/", verifyToken, getSummary);
router.get("/profit", verifyToken, getProfit);

export default router;
