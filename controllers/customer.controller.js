import Customer from '../models/customer.model.js';
import Invoice from '../models/invoice.model.js';

const createCustomer = async (req, res) => {
  const { customer_name, customer_email, customer_phone, customer_address } = req.body;

  try {
    if (!customer_name || !customer_email || !customer_phone || !customer_address) {
      return res.status(400).send({ message: 'All customer fields are required' });
    }

    const newCustomer = await Customer.create({
      user_id: req.user_id,
      customer_name,
      customer_email,
      customer_phone,
      customer_address
    });

    res.status(201).json(newCustomer);
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).send({ message: 'A customer with these details already exists' });
    }
    console.log(error);
    res.status(500).send({ message: `An error occurred while creating the customer ${error}` });
  }
};

const getAllCustomers = async (req, res) => {
  try {
    const customers = await Customer.findAll({ where: { user_id: req.user_id }, order: [['customer_name', 'ASC']] });
    res.status(200).json(customers);
  } catch (error) {
    console.log(error);
    res.status(500).send({ message: `An error occurred while fetching customers ${error}` });
  }
};

const getOneCustomer = async (req, res) => {
  try {
    const customer = await Customer.findOne({ where: { customer_id: req.params.id, user_id: req.user_id } });

    if (!customer) {
      return res.status(404).send({ message: 'Customer not found' });
    }

    res.status(200).json(customer);
  } catch (error) {
    console.log(error);
    res.status(500).send({ message: `An error occurred while fetching the customer ${error}` });
  }
};

const updateCustomer = async (req, res) => {
  const { customer_name, customer_email, customer_phone, customer_address } = req.body;

  try {
    const customer = await Customer.findOne({ where: { customer_id: req.params.id, user_id: req.user_id } });

    if (!customer) {
      return res.status(404).send({ message: 'Customer not found' });
    }

    // Only change the fields that were sent. Old invoices keep their own copy of the name.
    await customer.update({
      ...(customer_name !== undefined && { customer_name }),
      ...(customer_email !== undefined && { customer_email }),
      ...(customer_phone !== undefined && { customer_phone }),
      ...(customer_address !== undefined && { customer_address })
    });

    res.status(200).json(customer);
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).send({ message: 'A customer with these details already exists' });
    }
    console.log(error);
    res.status(500).send({ message: `An error occurred while updating the customer ${error}` });
  }
};

const deleteCustomer = async (req, res) => {
  try {
    const customer = await Customer.findOne({ where: { customer_id: req.params.id, user_id: req.user_id } });

    if (!customer) {
      return res.status(404).send({ message: 'Customer not found' });
    }

    // Don't delete a customer that has invoices, or their invoices would be lost
    const invoiceCount = await Invoice.count({ where: { customer_id: customer.customer_id } });
    if (invoiceCount > 0) {
      return res.status(409).send({ message: `Cannot delete: this customer has ${invoiceCount} invoice(s)` });
    }

    await customer.destroy();
    res.status(200).send({ message: 'Customer deleted successfully' });
  } catch (error) {
    console.log(error);
    res.status(500).send({ message: `An error occurred while deleting the customer ${error}` });
  }
};

export const customerController = {
  createCustomer,
  getAllCustomers,
  getOneCustomer,
  updateCustomer,
  deleteCustomer
};
