const express = require('express');
const { Pool } = require('pg');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Handle process exit
process.on('exit', (code) => {
  console.log('Process exited with code', code);
});

const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);

// API Key authentication middleware
const apiKeyAuth = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey || apiKey !== process.env.API_KEY) {
    return res.status(401).json({ error: 'Unauthorized: Invalid API Key' });
  }
  next();
};

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: true,  // Required for Render PostgreSQL
});

// Test database connection
(async () => {
  try {
    await pool.query('SELECT NOW()');
    console.log('Connected to PostgreSQL');
  } catch (err) {
    console.error('Failed to connect to PostgreSQL:', err.message);
  }
})();

// Routes

// Apply auth to protected routes
app.use('/ingredients', apiKeyAuth);
app.use('/updateingredient', apiKeyAuth);
app.use('/tables', apiKeyAuth);
app.use('/orders', apiKeyAuth);

app.get('/ingredients', async (req, res) => {
  try {
    const result = await pool.query('SELECT sal."fn_GetIngredients"()');
    res.json(result.rows);
  } catch (err) {
    console.error('Error in /ingredients:', err);
    res.status(500).send(err.message);
  }
});

app.post('/updateingredient', async (req, res) => {
  /**
   * @param {integer} Ingredient_Id - Ingredient ID
   * @param {text} Description - Ingredient name
   * @param {integer} Pack_Size - Description
   * @param {text} Pack_Type - Quantity
   * @param {numeric} Small_Serving - Unit
   * @param {numeric} Large_Serving - Price
   * @param {money} King_Kold_Price - Supplier
   * @param {money} Piqua_Pizza_Price - Is active
   * @param {boolean} Topping - Category
   */
  const { Ingredient_Id, Description, Pack_Size, Pack_Type, Small_Serving, Large_Serving, King_Kold_Price, Piqua_Pizza_Price, Topping } = req.body;
  try {
    const result = await pool.query('CALL sal."sp_UpdateIngredient"($1, $2, $3, $4, $5, $6, $7, $8, $9)', [Ingredient_Id, Description, Pack_Size, Pack_Type, Small_Serving, Large_Serving, King_Kold_Price, Piqua_Pizza_Price, Topping]);
    res.json({ message: 'Ingredient updated successfully' });
  } catch (err) {
    console.error('Error in /updateingredient:', err);
    res.status(500).send(err.message);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});