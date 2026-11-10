import Item from '../models/items.model.js';

const createItem = async (req, res) => {
  const { item_name, categories, unit_cost, unit_price } = req.body;

  try {
    if (!item_name || unit_cost === undefined || unit_price === undefined) {
      return res.status(400).send({ message: 'Item name, unit cost and unit price are required' });
    }

    if (isNaN(unit_cost) || Number(unit_cost) < 0) {
      return res.status(400).send({ message: 'Unit cost must be a positive number' });
    }

    if (isNaN(unit_price) || Number(unit_price) < 0) {
      return res.status(400).send({ message: 'Unit price must be a positive number' });
    }

    const newItem = await Item.create({
      item_name,
      unit_cost,
      unit_price,
      ...(categories && { categories }) // Optional: otherwise uses model default ('Sandwiches')
    });

    res.status(201).json(newItem);
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).send({ message: 'An item with this name already exists' });
    }
    if (error.name === 'SequelizeDatabaseError' && error.message.includes('enum')) {
      return res.status(400).send({ message: 'Invalid category' });
    }
    console.log(error);
    res.status(500).send({ message: `An error occurred while creating the item ${error}` });
  }
};

const getItems = async (req, res) => {
  try {
    const items = await Item.findAll({ order: [['categories', 'ASC'], ['item_name', 'ASC']] });
    res.status(200).json(items);
  } catch (error) {
    console.log(error);
    res.status(500).send({ message: `An error occurred while fetching items ${error}` });
  }
};

const getOneItem = async (req, res) => {
  try {
    const item = await Item.findByPk(req.params.id);

    if (!item) {
      return res.status(404).send({ message: 'Item not found' });
    }

    res.status(200).json(item);
  } catch (error) {
    console.log(error);
    res.status(500).send({ message: `An error occurred while fetching the item ${error}` });
  }
};

const updateItem = async (req, res) => {
  const { item_name, categories, unit_cost, unit_price } = req.body;

  try {
    const item = await Item.findByPk(req.params.id);

    if (!item) {
      return res.status(404).send({ message: 'Item not found' });
    }

    if (unit_cost !== undefined && (isNaN(unit_cost) || Number(unit_cost) < 0)) {
      return res.status(400).send({ message: 'Unit cost must be a positive number' });
    }

    if (unit_price !== undefined && (unit_price === null || isNaN(unit_price) || Number(unit_price) < 0)) {
      return res.status(400).send({ message: 'Unit price must be a positive number' });
    }

    // Only change the fields that were sent. Old invoices keep their own copy of the name, price and cost.
    await item.update({
      ...(item_name !== undefined && { item_name }),
      ...(categories !== undefined && { categories }),
      ...(unit_cost !== undefined && { unit_cost }),
      ...(unit_price !== undefined && { unit_price })
    });

    res.status(200).json(item);
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).send({ message: 'An item with this name already exists' });
    }
    if (error.name === 'SequelizeDatabaseError' && error.message.includes('enum')) {
      return res.status(400).send({ message: 'Invalid category' });
    }
    console.log(error);
    res.status(500).send({ message: `An error occurred while updating the item ${error}` });
  }
};

const deleteItem = async (req, res) => {
  try {
    const item = await Item.findByPk(req.params.id);

    if (!item) {
      return res.status(404).send({ message: 'Item not found' });
    }

    // Safe for old invoices: their lines keep the saved name and price (item_id becomes null)
    await item.destroy();
    res.status(200).send({ message: 'Item deleted successfully' });
  } catch (error) {
    console.log(error);
    res.status(500).send({ message: `An error occurred while deleting the item ${error}` });
  }
};

export const itemController = {
  createItem,
  getItems,
  getOneItem,
  updateItem,
  deleteItem
};
