const express = require('express');
const { Pool } = require('pg');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
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
app.set('trust proxy', 1);  // Render uses single proxy layer
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

// JWT authentication middleware
const jwtAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Unauthorized: Invalid token' });
    }
    req.user = user;
    next();
  });
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

app.post('/auth/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const result = await pool.query('SELECT id, username, password_hash FROM sal.users WHERE username = $1', [username]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const user = result.rows[0];
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = jwt.sign({ id: user.id, username: user.username }, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.json({ token });
  } catch (err) {
    console.error('Error in /auth/login:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Apply auth to protected routes
app.use('/ingredients', jwtAuth);
app.use('/ingredient/:ingredientId', jwtAuth);
app.use('/updateingredient', jwtAuth);
app.use('/tables', jwtAuth);
app.use('/orders', jwtAuth);

app.get('/ingredients', async (req, res) => {
  try {
    const result = await pool.query('SELECT sal."fn_GetIngredients"()');
    res.json(result.rows);
  } catch (err) {
    console.error('Error in /ingredients:', err);
    res.status(500).send(err.message);
  }
});

app.get('/ingredient/:ingredientId', async (req, res) => {
  const { ingredientId } = req.params;  
  try {
    const result = await pool.query('SELECT sal."fn_GetIngredientById"($1)', [ingredientId]);
    res.json(result.rows);
  } catch (err) {
    console.error('Error in /ingredient/:ingredientId:', err);
    res.status(500).send(err.message);
  } 
});

app.post('/updateingredient', async (req, res) => {
  /**
   * @param {integer} IngredientId - Ingredient ID
   * @param {text} inDescription - Ingredient name
   * @param {integer} inPackSize - Description
   * @param {text} inPackType - Quantity
   * @param {numeric} inSmallServing - Unit
   * @param {numeric} inLargeServing - Price
   * @param {money} inKingKoldPrice - Supplier
   * @param {money} inPiquaPizzaSupply - Is active
   * @param {boolean} inTopping - Category
   * @param {boolean} Appetizer - Category
   */
  const { IngredientId, inDescription, inPackSize, inPackType, inSmallServing, inLargeServing, inKingKoldPrice, inPiquaPizzaSupply, inTopping, inAppetizer } = req.body;
  try {
    const result = await pool.query('CALL sal."sp_UpdateIngredient"($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)', [IngredientId, inDescription, inPackSize, inPackType, inSmallServing, inLargeServing, inKingKoldPrice, inPiquaPizzaSupply, inTopping, inAppetizer]);
    res.json({ message: 'Ingredient updated successfully' });
  } catch (err) {
    console.error('Error in /updateingredient:', err);
    res.status(500).send(err.message);
  }
});

app.post('/insertingredient', async (req, res) => {
  /**
   * @param {text} inDescription - Ingredient name
   * @param {integer} inPackSize - Description
   * @param {text} inPackType - Quantity
   * @param {numeric} inSmallServing - Unit  
   * @param {numeric} inLargeServing - Price
   * @param {money} inKingKoldPrice - Supplier
   * @param {money} inPiquaPizzaSupply - Supplier2
   * @param {boolean} inTopping - Category
   * @param {boolean} inAppetizer - Category
   */
  const { inDescription, inPackSize, inPackType, inSmallServing, inLargeServing, inKingKoldPrice, inPiquaPizzaSupply, inTopping, inAppetizer } = req.body;

  try {
    const result = await pool.query('CALL sal."sp_InsertIngredient"($1, $2, $3, $4, $5, $6, $7, $8, $9)', [inDescription, inPackSize, inPackType, inSmallServing, inLargeServing, inKingKoldPrice, inPiquaPizzaSupply, inTopping, inAppetizer]);
    res.json({ message: 'Ingredient inserted successfully' });
  } catch (err) {
    console.error('Error in /insertingredient:', err);
    res.status(500).send(err.message);
  }
});

app.get('/appetizers', async (req, res) => {
  try {
    const result = await pool.query('SELECT sal."fn_GetAppetizers"()');   
    res.json(result.rows);
  } catch (err) {
    console.error('Error in /appetizers:', err);
    res.status(500).send(err.message);
  } 
});

app.get('/toppings', async (req, res) => {
  try {
    const result = await pool.query('SELECT sal."fn_GetToppings"()');
    res.json(result.rows);
  } catch (err) {
    console.error('Error in /toppings:', err);
    res.status(500).send(err.message);
  }
});

app.get('/pizzasizes', async (req, res) => {
  try {
    const result = await pool.query('SELECT sal."fn_GetPizzaSizes"()');  
    res.json(result.rows);
  } catch (err) {
    console.error('Error in /pizzasizes:', err);
    res.status(500).send(err.message);
  } 
});

app.post('/insertpizzaorder', async (req, res) => {
  /**
   * @param {integer} sizeid - Pizza Size ID
   * @param {array} toppingids - Array of Topping IDs
   * @param {date} orderdate - Date of Order
   */
  const { sizeid, toppingids, orderdate } = req.body;
  
  // Validate input
  if (!sizeid || !Array.isArray(toppingids) || !orderdate) {
    return res.status(400).json({ error: 'Invalid input: sizeid, toppingids (array), and orderdate are required' });
  }

  try {
    // Step 1: Create the pizza order and get the OrderId
    const orderResult = await pool.query(
      'SELECT sal."fn_InsertPizzaOrder"($1, $2, $3) AS "OrderId"',
      [sizeid, toppingids.length, orderdate]
    );
    
    if (!orderResult.rows || orderResult.rows.length === 0) {
      return res.status(500).json({ error: 'Failed to create order' });
    }

    const orderId = orderResult.rows[0].OrderId;

    // Step 2: Insert each topping for this order
    for (const toppingId of toppingids) {
      await pool.query(
        'CALL sal."sp_InsertPizzaOrderItem"($1, $2)',
        [orderId, toppingId]
      );
    }

    res.json({ 
      message: 'Pizza order created successfully',
      orderId: orderId,
      toppingCount: toppingids.length 
    });
  } catch (err) {
    console.error('Error in /insertpizzaorder:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/appetizerprices', async (req, res) => {
  try {
    const result = await pool.query('SELECT sal."fn_GetAppetizerPrices"()');
    res.json(result.rows);
  } catch (err) {
    console.error('Error in /appetizerprices:', err);
    res.status(500).send(err.message);
  }
});

app.post('/insertappetizerorder', async (req, res) => {
  /**
   * @param {date} appetizerorderdate - Date of Order
   * @param {Array<{ingredientid:number,total:number}>} items - Line items with ingredient and line total
   * @param {money} [ordertotal] - Optional overall total; if omitted, we sum item totals
   */
  const { appetizerorderdate, items, ordertotal } = req.body;

  // Basic validation
  if (!appetizerorderdate || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Invalid input: appetizerorderdate and items[] are required' });
  }

  // Normalize to integers because sp_InsertAppetizerOrderItem expects integers
  const cleanedItems = items.map((item) => ({
    ingredientid: parseInt(item.ingredientid, 10),
    total: parseInt(item.quantity, 10)
  })).filter((item) => Number.isInteger(item.ingredientid) && Number.isInteger(item.total));

  if (cleanedItems.length === 0) {
    return res.status(400).json({ error: 'Invalid items: each needs ingredientid and quantity' });
  }

  const computedTotal = cleanedItems.reduce((sum, item) => sum + item.total, 0);
  const finalTotal = ordertotal !== undefined && ordertotal !== null ? parseFloat(ordertotal) : computedTotal;

  try {
    // Insert appetizer order header; adjust function name/params if your SQL signature differs
    const orderResult = await pool.query(
      'SELECT sal."fn_InsertAppetizerOrder"($1, $2) AS "OrderId"',
      [appetizerorderdate, finalTotal]
    );

    if (!orderResult.rows || orderResult.rows.length === 0) {
      return res.status(500).json({ error: 'Failed to create order' });
    }

    const orderId = orderResult.rows[0].OrderId;

    // Insert each appetizer line item
    for (const item of cleanedItems) {
      await pool.query(
        'CALL sal."sp_InsertAppetizerOrderItem"($1, $2, $3)',
        [parseInt(orderId, 10), item.ingredientid, item.total]
      );
    }

    res.json({
      message: 'Appetizer order created successfully',
      orderId,
      itemCount: cleanedItems.length,
      orderTotal: finalTotal
    });
  } catch (err) {
    console.error('Error in /insertappetizerorder:', err);
    res.status(500).json({ error: err.message });
  }
});
  
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});