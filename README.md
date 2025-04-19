# E-Commerce Backend

Backend service for the CoolGarmi E-Commerce platform, providing API endpoints for products, users, orders, and more.

## Getting Started

These instructions will help you set up and run the project on your local machine for development and testing purposes.

### Prerequisites

- Node.js (v14 or higher)
- MongoDB
- npm or yarn

### Installation

1. Clone the repository
   ```
   git clone <repository-url>
   cd E-Commerce-Backend
   ```

2. Install dependencies
   ```
   npm install
   ```

3. Set up environment variables
   Create a `.env` file in the root directory and add the following variables:
   ```
   MONGO_URI=your_mongodb_connection_string
   JWT_SECRET=your_jwt_secret_key
   PORT=5000
   ```

### Running the Application

#### Development Mode
To run the application in development mode with nodemon (auto-restart on file changes):
```
npm run dev
```

#### Seed Database
To populate the database with sample data (products, users, orders):
```
npm run seed
```

## Frontend Repository

The frontend of this application is available at:
[E-Commerce Frontend](https://github.com/Va16hav07/E-Commerce)

## API Documentation

### Authentication Endpoints
- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login a user
- `GET /api/auth/me` - Get current user details

### Product Endpoints
- `GET /api/products` - Get all products
- `GET /api/products/:id` - Get product by ID
- `POST /api/products` - Create a new product (Admin only)
- `PUT /api/products/:id` - Update a product (Admin only)
- `DELETE /api/products/:id` - Delete a product (Admin only)

### Order Endpoints
- `GET /api/orders` - Get all orders (Admin only)
- `GET /api/orders/my-orders` - Get current user's orders
- `POST /api/orders` - Create a new order
- `PUT /api/orders/:id/status` - Update order status (Admin/Rider only)

## Project Structure

```
E-Commerce-Backend/
├── models/           # MongoDB schema models
├── controllers/      # Route controllers
├── routes/           # API routes
├── middleware/       # Custom middleware
├── utils/            # Utility functions
├── config/           # Configuration files
└── server.js         # Entry point
```

## Technologies Used

- Node.js & Express - Server framework
- MongoDB & Mongoose - Database
- JSON Web Token (JWT) - Authentication
- bcryptjs - Password hashing
