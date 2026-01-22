# PostgreSQL API Template

A simple Node.js API using Express and PostgreSQL.

## Setup

1. Install dependencies:
   ```
   npm install
   ```

2. Set up PostgreSQL database:
   - Create a database named `pizza_orders`
   - Create a table:
     ```sql
     CREATE TABLE orders (
       id SERIAL PRIMARY KEY,
       customer_name VARCHAR(255),
       pizza_type VARCHAR(255),
       quantity INTEGER
     );
     ```

3. Update `.env` file with your PostgreSQL credentials and API key.

4. Run the server:
   ```
   npm start
   ```

## API Endpoints

- `POST /auth/login`: Login with {username, password}, returns JWT token
- `GET /ingredients`: Get all ingredients (requires JWT in Authorization header)
- `POST /updateingredient`: Update an ingredient (requires JWT)
- `GET /tables`: List database tables (requires JWT)
- `GET /orders`: Get all orders (requires JWT)
- `POST /orders`: Create a new order (requires JWT)

## Authentication

Use `POST /auth/login` to get a JWT token. Include it in requests as `Authorization: Bearer <token>`.

## Security

Rate limiting (100 requests/15min/IP), Helmet headers, CORS enabled.

For production on Render, set environment variables in the service dashboard.