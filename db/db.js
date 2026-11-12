import dotenv from 'dotenv';
import { Sequelize } from 'sequelize';

dotenv.config();

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  logging: false,
  pool: {
    max: 5,
    min: 1,
    idle: 30000,
    acquire: 30000
  }
});

// Customer details, item names and invoice/return numbers used to be unique across the whole app.
// They are now unique per user, but sync() never removes the old rules, so remove them here.
// Does nothing once they are gone.
async function dropAppWideUniqueRules() {
  await sequelize.query(`
    DO $$
    DECLARE old_rule record;
    BEGIN
      FOR old_rule IN
        SELECT t.relname AS table_name, c.conname AS rule_name
        FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
        WHERE c.contype = 'u'
          AND c.connamespace = current_schema()::regnamespace
          AND array_length(c.conkey, 1) = 1
          AND (t.relname, a.attname) IN (
            ('Customers', 'customer_name'), ('Customers', 'customer_email'),
            ('Customers', 'customer_phone'), ('Customers', 'customer_address'),
            ('Invoices', 'invoice_number'), ('ReturnInvoices', 'return_number'),
            ('Items', 'item_name')
          )
      LOOP
        EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', old_rule.table_name, old_rule.rule_name);
      END LOOP;
    END $$;
  `);
}

export async function initDB() {
  await import('../models/user.model.js');
  // await import('../models/product.model.js');
   await import('../models/associations.js');
 

  await sequelize.authenticate();
  console.log('Connection established successfully.');

  await dropAppWideUniqueRules();
  await sequelize.sync({ alter: true });
  console.log('Tables created/synced');
}

export default sequelize;