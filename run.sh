#!/bin/bash

# Script to run both client and server, then terminate on Enter key press

echo "Starting Pride Map..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Start server in background
echo "Starting server on http://localhost:3001..."
(cd server && node server.js) &
SERVER_PID=$!

# Wait a moment for server to start
sleep 2

# Start client in background
echo "Starting client on http://localhost:5173..."
(cd client/pridemap && npm run dev) &
CLIENT_PID=$!

# Wait for client to start
sleep 2

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✓ Server running (PID: $SERVER_PID)"
echo "✓ Client running (PID: $CLIENT_PID)"
echo ""
echo "Press ENTER to stop both processes..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Wait for Enter key
read -p ""

# Cleanup function
cleanup() {
    echo ""
    echo "Shutting down..."
    
    # Kill server and all its children
    if ps -p $SERVER_PID > /dev/null 2>&1; then
        echo "Stopping server (PID: $SERVER_PID)..."
        kill -TERM $SERVER_PID 2>/dev/null
    fi
    
    # Kill client and all its children (Vite spawns multiple processes)
    if ps -p $CLIENT_PID > /dev/null 2>&1; then
        echo "Stopping client (PID: $CLIENT_PID)..."
        kill -TERM $CLIENT_PID 2>/dev/null
    fi
    
    # Kill any remaining vite and node processes related to our project
    pkill -f "vite.*pridemap" 2>/dev/null
    sleep 1
    
    echo "✓ All processes stopped"
}

# Call cleanup
cleanup
exit 0
