#!/bin/bash

# Zerodha Portfolio Tracker Setup Script
echo "🚀 Setting up Zerodha Portfolio Tracker..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js v16 or higher."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm."
    exit 1
fi

# Check if PostgreSQL is installed
if ! command -v psql &> /dev/null; then
    echo "⚠️  PostgreSQL is not installed. Please install PostgreSQL v12 or higher."
    echo "You can continue with the setup, but you'll need to install PostgreSQL later."
fi



# Install dependencies
echo "📦 Installing dependencies..."

# Install root dependencies
npm install

# Install backend dependencies
cd backend
npm install
cd ..

# Install frontend dependencies
cd frontend
npm install
cd ..

echo "✅ Dependencies installed successfully"

# Create environment file
if [ ! -f .env ]; then
    echo "📝 Creating environment file..."
    cp env.example .env
    echo "✅ Environment file created. Please edit .env with your configuration."
else
    echo "✅ Environment file already exists"
fi

# Database setup
echo "🗄️  Setting up database..."

# Check if PostgreSQL is running
if command -v psql &> /dev/null; then
    echo "Creating database..."
    psql -U postgres -c "CREATE DATABASE zerodha_portfolio;" 2>/dev/null || echo "Database might already exist"
    
    echo "Running schema..."
    psql -U postgres -d zerodha_portfolio -f database/schema.sql 2>/dev/null || echo "Schema might already be applied"
    
    echo "✅ Database setup completed"
else
    echo "⚠️  PostgreSQL not found. Please install PostgreSQL and run the schema manually:"
    echo "   psql -U postgres -d zerodha_portfolio -f database/schema.sql"
fi



echo ""
echo "🎉 Setup completed!"
echo ""
echo "Next steps:"
echo "1. Edit .env file with your Zerodha API credentials"
echo "2. Start the application:"
echo "   - Development: npm run dev"
echo "   - Production: npm run build && npm start"
echo "   - Frontend will be available at: http://localhost:7000"
echo "   - Backend API will be available at: http://localhost:7001"
echo ""
echo "📖 Read README.md for detailed instructions"
echo ""
echo "Happy trading! 📈" 