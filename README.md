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

- `GET /ingredients`: Get all ingredients (requires API key)
- `POST /updateingredient`: Update an ingredient (requires API key)
- `GET /tables`: List database tables (requires API key)
- `GET /orders`: Get all orders (requires API key)
- `POST /orders`: Create a new order (requires API key)

## Security

All endpoints except the root require an API key in the `X-API-Key` header. Rate limiting is enabled (100 requests per 15 minutes per IP).

For production on Render, set environment variables in the service dashboard.