import express from "express";
import { createReturn, getReturns, getReturn, updateReturn, deleteReturn } from "../controllers/returnInvoice.controller.js";
import { verifyToken } from "../middlewares/auth.js";
const router = express.Router();

router.post("/createReturn", verifyToken, createReturn);
router.get("/getReturns", verifyToken, getReturns);
router.get("/getReturn/:id", verifyToken, getReturn);
router.put("/updateReturn/:id", verifyToken, updateReturn);
router.delete("/deleteReturn/:id", verifyToken, deleteReturn);

export default router;
