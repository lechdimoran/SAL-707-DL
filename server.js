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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});