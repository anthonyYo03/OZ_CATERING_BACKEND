import express from 'express';
import { verifyToken } from '../middlewares/auth.js';
import { customerController } from '../controllers/customer.controller.js';

const router = express.Router();

// POST /createCustomer - Create a new customer
router.post('/createCustomer',verifyToken ,customerController.createCustomer);

// GET /getAllCustomers - Get all customers
router.get('/getAllCustomers',verifyToken ,customerController.getAllCustomers);

// GET /getOneCustomer/:id - Get one customer
router.get('/getOneCustomer/:id', verifyToken, customerController.getOneCustomer);

// PUT /updateCustomer/:id - Update a customer
router.put('/updateCustomer/:id', verifyToken, customerController.updateCustomer);

// DELETE /deleteCustomer/:id - Delete a customer
router.delete('/deleteCustomer/:id', verifyToken, customerController.deleteCustomer);

export default router;
