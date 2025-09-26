# Asset Management

A comprehensive multi-account portfolio tracking application for Zerodha users, built with modern web technologies.

## 🚀 Features

- **Multi-Account Support**: Manage multiple Zerodha accounts in one place
- **Real-time Portfolio Tracking**: Monitor holdings, positions, and P&L across all accounts
- **Advanced Analytics**: Detailed charts and insights for portfolio performance
- **Secure API Integration**: Safe integration with Zerodha Kite Connect API
- **Responsive Design**: Modern, mobile-friendly interface
- **Real-time Updates**: Auto-refresh data every 30 seconds

## 🛠️ Technology Stack

### Frontend
- **React 18** with TypeScript
- **Tailwind CSS** for styling
- **@headlessui/react** for accessible UI components
- **@heroicons/react** for beautiful icons
- **@tanstack/react-query** (v5) for data fetching and caching
- **React Router DOM** for client-side routing
- **Recharts** for data visualization
- **Create React App** for development and building

### Backend
- **Node.js** with TypeScript
- **Express.js** for API framework
- **Prisma** for database ORM
- **PostgreSQL** for database
- **Helmet** for security headers
- **Express Rate Limit** for API protection
- **Express.js** for API development
- **bcryptjs** for password hashing
- **Zerodha Kite Connect API** integration

### Development Tools
- **TypeScript** for type safety
- **ESLint** for code linting
- **Prettier** for code formatting
- **Nodemon** for backend development
- **Concurrently** for running both frontend and backend

## 📋 Prerequisites

- Node.js (v18 or higher)
- PostgreSQL database
- Zerodha Kite Connect API credentials

## 🚀 Quick Start

### 1. Clone the Repository
```bash
git clone <repository-url>
cd zerodha-portfolio-tracker
```

### 2. Install Dependencies
```bash
# Install all dependencies (root, backend, and frontend)
npm run install:all
```

### 3. Environment Setup

Create a `.env` file in the root directory:
```env
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/assetManagement"

# Server
PORT=7001
NODE_ENV=development

# Frontend
FRONTEND_URL=http://localhost:7000

# Authentication (removed - no longer required)

# Zerodha API (optional for development)
ZERODHA_API_KEY=your-api-key
ZERODHA_API_SECRET=your-api-secret
```

### 4. Database Setup
```bash
# Navigate to backend directory
cd backend

# Generate Prisma client
npm run db:generate

# Push database schema
npm run db:push

# (Optional) Seed database with sample data
npm run db:seed
```

### 5. Start Development Servers
```bash
# Start both frontend and backend
npm run dev
```

The application will be available at:
- **Frontend**: http://localhost:7000
- **Backend API**: http://localhost:7001

## 📁 Project Structure

```
zerodha-portfolio-tracker/
├── frontend/                 # React frontend application
│   ├── public/              # Static assets
│   ├── src/
│   │   ├── components/      # Reusable UI components
│   │   ├── pages/          # Page components
│   │   ├── services/       # API services
│   │   └── contexts/       # React contexts
│   ├── package.json
│   └── tailwind.config.js  # Tailwind CSS configuration
├── backend/                 # Node.js backend application
│   ├── src/
│   │   ├── routes/         # API routes
│   │   ├── middleware/     # Express middleware
│   │   ├── services/       # Business logic
│   │   └── utils/          # Utility functions
│   ├── prisma/             # Database schema and migrations
│   └── package.json
├── package.json            # Root package.json
└── README.md
```

## 🔧 Available Scripts

### Root Level
```bash
npm run dev              # Start both frontend and backend
npm run dev:frontend     # Start only frontend
npm run dev:backend      # Start only backend
npm run install:all      # Install all dependencies
npm run build            # Build both frontend and backend
npm run test             # Run frontend tests
```

### Frontend
```bash
npm start               # Start development server
npm run build           # Build for production
npm test                # Run tests
npm run eject           # Eject from Create React App
```

### Backend
```bash
npm run dev             # Start development server
npm run build           # Build TypeScript
npm run start           # Start production server
npm run db:generate     # Generate Prisma client
npm run db:push         # Push database schema
npm run db:migrate      # Run database migrations
npm run db:studio       # Open Prisma Studio
npm run db:seed         # Seed database
```

## 🔐 Security Features

- **RESTful API**: Clean and organized API endpoints
- **Password Hashing**: bcryptjs for secure password storage
- **API Rate Limiting**: Protection against abuse
- **CORS Configuration**: Secure cross-origin requests
- **Helmet Security**: Security headers
- **Input Validation**: Express-validator for API validation

## 📊 API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout

### Accounts
- `GET /api/accounts` - Get user accounts
- `POST /api/accounts` - Create new account
- `PUT /api/accounts/:id` - Update account
- `DELETE /api/accounts/:id` - Delete account

### Portfolio Data
- `GET /api/holdings` - Get holdings data
- `GET /api/positions` - Get positions data
- `GET /api/portfolio` - Get portfolio summary

## 🎨 UI Components

The application uses a modern design system with:
- **Tailwind CSS** for utility-first styling
- **Headless UI** for accessible components
- **Heroicons** for consistent iconography
- **Responsive design** for all screen sizes
- **Dark mode support** (planned)

## 🔄 Data Flow

1. **Frontend** makes API calls using React Query
2. **Backend** processes requests and validates data
3. **Prisma ORM** handles database operations
4. **Zerodha API** provides real-time market data
5. **Real-time updates** via polling every 30 seconds

## 🚀 Deployment

### Frontend Deployment
```bash
cd frontend
npm run build
# Deploy the build folder to your hosting service
```

### Backend Deployment
```bash
cd backend
npm run build
npm start
# Deploy to your server or cloud platform
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📝 License

This project is licensed under the MIT License.

## 🙏 Acknowledgments

- Zerodha for providing the Kite Connect API
- The React and Node.js communities
- Tailwind CSS for the amazing styling framework 