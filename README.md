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

3. Update `.env` file with your PostgreSQL credentials.

4. Run the server:
   ```
   npm start
   ```

## API Endpoints

- `GET /`: Welcome message
- `GET /orders`: Get all orders
- `POST /orders`: Create a new order (JSON body: { customer_name, pizza_type, quantity })

## Usage

Start the server and use tools like Postman or curl to test the endpoints.