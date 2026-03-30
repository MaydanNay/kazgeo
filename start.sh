#!/bin/bash

# Function to kill background processes on exit
cleanup() {
    echo ""
    echo "Stopping KazGEO services..."
    kill $BACKEND_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    exit
}

# Trap Ctrl+C (SIGINT)
trap cleanup SIGINT

# Kill any existing process on port 8000 before starting
EXISTING_PID=$(lsof -t -i:8000)
if [ ! -z "$EXISTING_PID" ]; then
    echo "Killing existing process on port 8000..."
    kill -9 $EXISTING_PID 2>/dev/null
fi

echo "Starting KazGEO Backend..."
./backend/venv/bin/python3 -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

echo "Starting KazGEO Frontend..."
# Using npx serve to serve the 'src' directory on port 3000
npx serve src -l 3000 &
FRONTEND_PID=$!

echo ""
echo "--------------------------------------------------"
echo "🚀 KAZGEOMINER is running!"
echo ""
echo "📱 Main Page:      http://localhost:3000"
echo "👤 User Dashboard:  http://localhost:3000/profile.html"
echo "🛡️  Admin Panel:     http://localhost:3000/admin.html"
echo "📖 API Docs:        http://localhost:8000/docs"
echo "--------------------------------------------------"
echo "Press Ctrl+C to stop all services."

# Wait for background processes
wait
