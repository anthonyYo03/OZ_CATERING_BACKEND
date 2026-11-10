import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { initDB } from './db/db.js';
import userRoutes from './routes/user.routes.js';
import invoiceRoutes from './routes/invoice.route.js';
import customerRoutes from './routes/customer.route.js';
import itemRoutes from './routes/items.routes.js';
import returnRoutes from './routes/returnInvoice.route.js';
import summaryRoutes from './routes/summary.route.js';


const app = express();
dotenv.config(); 

app.use(cors({
  origin: process.env.FRONTEND_URL,
  methods: ["GET", "POST", "PUT", "DELETE","OPTIONS"],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));
app.use('/api/user', userRoutes);
app.use("/api/invoices", invoiceRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/items", itemRoutes);
app.use("/api/returns", returnRoutes);
app.use("/api/summary", summaryRoutes);

try {
  console.log('Connecting to database...');
  await initDB();
  console.log('Database connected!');
  const PORT = process.env.PORT || 5000;
  app.listen(PORT,() => console.log(`Server running on port ${PORT}`));
} catch (err) {
  console.error('Startup error:', err);
  process.exit(1);
}