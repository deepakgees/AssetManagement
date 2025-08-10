#!/bin/bash

echo "🚀 Starting Backend in Debug Mode..."
echo "📝 Available debugging options:"
echo "   1. VS Code Debugger (recommended) - Use Debug panel in VS Code"
echo "   2. Chrome DevTools - Run 'npm run debug' then open chrome://inspect"
echo "   3. Command line debugging - Run 'npm run debug-brk'"
echo ""
echo "🔧 Starting with debug logging enabled..."

# Set debug environment variables
export NODE_ENV=development
export LOG_LEVEL=debug

# Change to backend directory and start the debugger
cd backend
npm run debug
