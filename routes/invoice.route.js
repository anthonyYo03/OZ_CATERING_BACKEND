import express from "express";
import { createInvoice, getInvoice, getInvoices, updateInvoice } from "../controllers/invoice.controller.js";
import { verifyToken } from "../middlewares/auth.js";
const router = express.Router();

router.post("/createInvoice",verifyToken, createInvoice);
router.get("/getInvoices", verifyToken, getInvoices);
router.get("/getInvoice/:id", verifyToken, getInvoice);
router.put("/updateInvoice/:id", verifyToken, updateInvoice);

export default router;
