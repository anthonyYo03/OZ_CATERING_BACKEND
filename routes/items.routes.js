import express from 'express';
import { verifyToken } from '../middlewares/auth.js';
import { itemController } from '../controllers/items.controller.js';

const router = express.Router();

// POST /createItem - Create a new item
router.post('/createItem', verifyToken, itemController.createItem);

// GET /getItems - Get all items
router.get('/getItems', verifyToken, itemController.getItems);

// GET /getOneItem/:id - Get one item
router.get('/getOneItem/:id', verifyToken, itemController.getOneItem);

// PUT /updateItem/:id - Update an item
router.put('/updateItem/:id', verifyToken, itemController.updateItem);

// DELETE /deleteItem/:id - Delete an item
router.delete('/deleteItem/:id', verifyToken, itemController.deleteItem);

export default router;
