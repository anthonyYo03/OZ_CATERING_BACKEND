import express from "express";
import { createReceipt, getReceipts, getReceipt, updateReceipt, deleteReceipt } from "../controllers/receipt.controller.js";
import { verifyToken } from "../middlewares/auth.js";
const router = express.Router();

router.post("/createReceipt", verifyToken, createReceipt);
router.get("/getReceipts", verifyToken, getReceipts);
router.get("/getReceipt/:id", verifyToken, getReceipt);
router.put("/updateReceipt/:id", verifyToken, updateReceipt);
router.delete("/deleteReceipt/:id", verifyToken, deleteReceipt);

export default router;
