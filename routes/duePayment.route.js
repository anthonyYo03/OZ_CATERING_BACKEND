import express from "express";
import { getDuePayments, getDuePayment, getCustomerBalance } from "../controllers/duePayment.controller.js";
import { verifyToken } from "../middlewares/auth.js";
const router = express.Router();

router.get("/getDuePayments", verifyToken, getDuePayments);
router.get("/getDuePayment/:id", verifyToken, getDuePayment);
router.get("/customerBalance/:customerId", verifyToken, getCustomerBalance);

export default router;
