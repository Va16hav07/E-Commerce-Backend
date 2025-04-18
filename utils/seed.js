const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Product = require('../models/Product');
const ApprovedEmail = require('../models/ApprovedEmail');
const User = require('../models/User');
const Order = require('../models/Order');
const bcrypt = require('bcryptjs'); // Add bcrypt for password hashing

// Load environment variables
dotenv.config();

// Enum definitions
const UserRole = {
  CUSTOMER: 'CUSTOMER',
  ADMIN: 'ADMIN',
  RIDER: 'RIDER'
};

const OrderStatus = {
  PAID: 'PAID',
  SHIPPED: 'SHIPPED',
  IN_TRANSIT: 'IN_TRANSIT',
  DELIVERED: 'DELIVERED'
};

// Sample products data
const products = [
  {
    title: 'Arctic Chill 1.5 Ton Split AC',
    description: 'Energy efficient split AC with advanced cooling technology and low noise operation. Includes air purification and rapid cooling features.',
    price: 32999,
    image: 'https://i.imgur.com/8yUf7UL.jpg',
    category: 'Air Conditioner',
    sizes: ['1 Ton', '1.5 Ton', '2 Ton'],
    colors: ['White', 'Silver'],
    variants: [
      { color: 'White', size: '1 Ton', price: 29999, stock: 15 },
      { color: 'White', size: '1.5 Ton', price: 32999, stock: 20 },
      { color: 'White', size: '2 Ton', price: 36999, stock: 10 },
      { color: 'Silver', size: '1 Ton', price: 30999, stock: 8 },
      { color: 'Silver', size: '1.5 Ton', price: 33999, stock: 12 },
      { color: 'Silver', size: '2 Ton', price: 37999, stock: 7 },
    ],
    rating: 4.5,
    available_quantity: 72
  },
  {
    title: 'BreezeMaster Ceiling Fan',
    description: 'High-speed ceiling fan with elegant design. Features 5 speed settings, silent operation, and energy efficient motor with 2-year warranty.',
    price: 2499,
    image: 'https://i.imgur.com/NKDdASM.jpg',
    category: 'Ceiling Fan',
    sizes: ['48 inch', '56 inch'],
    colors: ['Brown', 'White', 'Black'],
    variants: [
      { color: 'Brown', size: '48 inch', price: 2499, stock: 25 },
      { color: 'Brown', size: '56 inch', price: 2999, stock: 15 },
      { color: 'White', size: '48 inch', price: 2499, stock: 20 },
      { color: 'White', size: '56 inch', price: 2999, stock: 10 },
      { color: 'Black', size: '48 inch', price: 2699, stock: 15 },
      { color: 'Black', size: '56 inch', price: 3199, stock: 8 },
    ],
    rating: 4.2,
    available_quantity: 93
  },
  {
    title: 'WindForce Tower Fan',
    description: 'Slim, oscillating tower fan with remote control. Features 3 speeds, multiple wind modes, and programmable timer for convenience.',
    price: 3999,
    image: 'https://i.imgur.com/vL9UhWe.jpg',
    category: 'Tower Fan',
    sizes: ['36 inch', '42 inch'],
    colors: ['Black', 'White'],
    variants: [
      { color: 'Black', size: '36 inch', price: 3999, stock: 30 },
      { color: 'Black', size: '42 inch', price: 4599, stock: 20 },
      { color: 'White', size: '36 inch', price: 3999, stock: 25 },
      { color: 'White', size: '42 inch', price: 4599, stock: 15 },
    ],
    rating: 4.0,
    available_quantity: 90
  },
  {
    title: 'DeskCool Table Fan',
    description: 'Compact table fan with adjustable tilt and powerful airflow. Includes 3 speed settings and wide oscillation range for maximum comfort.',
    price: 1499,
    image: 'https://i.imgur.com/RAU7Z6f.jpg',
    category: 'Table Fan',
    sizes: ['12 inch', '16 inch'],
    colors: ['Blue', 'White', 'Black'],
    variants: [
      { color: 'Blue', size: '12 inch', price: 1499, stock: 40 },
      { color: 'Blue', size: '16 inch', price: 1899, stock: 30 },
      { color: 'White', size: '12 inch', price: 1499, stock: 35 },
      { color: 'White', size: '16 inch', price: 1899, stock: 25 },
      { color: 'Black', size: '12 inch', price: 1599, stock: 20 },
      { color: 'Black', size: '16 inch', price: 1999, stock: 15 },
    ],
    rating: 4.3,
    available_quantity: 165
  },
  {
    title: 'PolarFrost Inverter AC',
    description: 'Advanced inverter AC with intelligent cooling and Wi-Fi connectivity. Features low power consumption, silent operation, and smart temperature control.',
    price: 44999,
    image: 'https://i.imgur.com/sn4ofDi.jpg',
    category: 'Air Conditioner',
    sizes: ['1 Ton', '1.5 Ton', '2 Ton'],
    colors: ['White', 'Gold'],
    variants: [
      { color: 'White', size: '1 Ton', price: 44999, stock: 10 },
      { color: 'White', size: '1.5 Ton', price: 49999, stock: 15 },
      { color: 'White', size: '2 Ton', price: 54999, stock: 8 },
      { color: 'Gold', size: '1 Ton', price: 46999, stock: 7 },
      { color: 'Gold', size: '1.5 Ton', price: 51999, stock: 12 },
      { color: 'Gold', size: '2 Ton', price: 56999, stock: 5 },
    ],
    rating: 4.7,
    available_quantity: 57
  }
];

// Users data
const users = [
  {
    name: 'John Doe',
    email: 'john@example.com',
    password: 'password123',
    role: UserRole.CUSTOMER,
    phone: '555-1234'
  },
  {
    name: 'Admin User',
    email: 'admin@coolgarmi.com',
    password: 'admin123',
    role: UserRole.ADMIN,
    phone: '555-5678'
  },
  {
    name: 'Rider One',
    email: 'rider1@coolgarmi.com',
    password: 'rider123',
    role: UserRole.RIDER,
    phone: '555-9101'
  },
  {
    name: 'Rider Two',
    email: 'rider2@coolgarmi.com',
    password: 'rider123',
    role: UserRole.RIDER,
    phone: '555-1213'
  }
];

// Orders data
const orders = [
  {
    customerId: null, // Will be populated after users are created
    customerName: 'John Doe',
    customerAddress: '123 Cooling St, Chill City, 10001',
    customerPhone: '555-1234',
    items: [
      {
        productId: null, // Will be populated after products are created
        productName: 'Arctic Chill 1.5 Ton Split AC',
        color: 'White',
        size: '1.5 Ton',
        price: 32999,
        quantity: 1
      }
    ],
    totalAmount: 32999,
    status: OrderStatus.PAID,
    riderId: null, // Will be populated after users are created
    riderName: 'Rider One',
    createdAt: new Date('2023-05-15'),
    updatedAt: new Date('2023-05-15')
  },
  {
    customerId: null, // Will be populated after users are created
    customerName: 'John Doe',
    customerAddress: '123 Cooling St, Chill City, 10001',
    customerPhone: '555-1234',
    items: [
      {
        productId: null, // Will be populated after products are created
        productName: 'BreezeMaster Ceiling Fan',
        color: 'Brown',
        size: '48 inch',
        price: 2499,
        quantity: 2
      }
    ],
    totalAmount: 4998,
    status: OrderStatus.SHIPPED,
    riderId: null, // Will be populated after users are created
    riderName: 'Rider Two',
    createdAt: new Date('2023-05-10'),
    updatedAt: new Date('2023-05-11')
  },
  {
    customerId: null, // Will be populated after users are created
    customerName: 'John Doe',
    customerAddress: '123 Cooling St, Chill City, 10001',
    customerPhone: '555-1234',
    items: [
      {
        productId: null, // Will be populated after products are created
        productName: 'DeskCool Table Fan',
        color: 'Blue',
        size: '12 inch',
        price: 1499,
        quantity: 1
      },
      {
        productId: null, // Will be populated after products are created
        productName: 'WindForce Tower Fan',
        color: 'Black',
        size: '36 inch',
        price: 3999,
        quantity: 1
      }
    ],
    totalAmount: 5498,
    status: OrderStatus.IN_TRANSIT,
    riderId: null, // Will be populated after users are created
    riderName: 'Rider One',
    createdAt: new Date('2023-05-05'),
    updatedAt: new Date('2023-05-07')
  },
  {
    customerId: null, // Will be populated after users are created
    customerName: 'John Doe',
    customerAddress: '123 Cooling St, Chill City, 10001',
    customerPhone: '555-1234',
    items: [
      {
        productId: null, // Will be populated after products are created
        productName: 'PolarFrost Inverter AC',
        color: 'White',
        size: '1 Ton',
        price: 44999,
        quantity: 1
      }
    ],
    totalAmount: 44999,
    status: OrderStatus.DELIVERED,
    riderId: null, // Will be populated after users are created
    riderName: 'Rider Two',
    createdAt: new Date('2023-04-25'),
    updatedAt: new Date('2023-04-28')
  }
];

// Approved emails for testing
const approvedEmails = [
  { email: 'admin@coolgarmi.com', role: UserRole.ADMIN },
  { email: 'rider1@coolgarmi.com', role: UserRole.RIDER },
  { email: 'rider2@coolgarmi.com', role: UserRole.RIDER },
  { email: 'john@example.com', role: UserRole.RIDER }
];

// Function to reset collections and seed data
const seedData = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 15000
    });

    console.log('MongoDB Connected');

    // Clear existing data
    await Product.deleteMany({});
    await ApprovedEmail.deleteMany({});
    await User.deleteMany({});
    await Order.deleteMany({});

    console.log('Data cleared');

    // Seed products
    const createdProducts = await Product.insertMany(products);
    console.log(`${products.length} products seeded`);

    // Seed approved emails
    await ApprovedEmail.insertMany(approvedEmails);
    console.log(`${approvedEmails.length} approved emails seeded`);

    // Hash passwords for users
    for (const user of users) {
      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(user.password, salt);
    }
    
    // Seed users
    const createdUsers = await User.insertMany(users);
    console.log(`${users.length} users seeded`);

    // Get references for orders
    const customerUser = createdUsers.find(user => user.role === UserRole.CUSTOMER);
    const rider1 = createdUsers.find(user => user.email === 'rider1@coolgarmi.com');
    const rider2 = createdUsers.find(user => user.email === 'rider2@coolgarmi.com');
    
    // Map product names to ids
    const productMap = {};
    createdProducts.forEach(product => {
      productMap[product.title] = product._id;
    });

    // Update order references
    orders.forEach(order => {
      order.customerId = customerUser._id;
      
      if (order.riderName === 'Rider One') {
        order.riderId = rider1._id;
      } else if (order.riderName === 'Rider Two') {
        order.riderId = rider2._id;
      }
      
      order.items.forEach(item => {
        item.productId = productMap[item.productName];
      });
    });

    // Seed orders
    await Order.insertMany(orders);
    console.log(`${orders.length} orders seeded`);

    console.log('Data seeding complete!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding data:', error);
    process.exit(1);
  }
};

// Run the seeding function
seedData();
