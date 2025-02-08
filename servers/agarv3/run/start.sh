#!/bin/bash
# start.sh - Restart the Node.js application if it crashes

# Check if the node_modules folder exists one level up. If not, run npm install.
if [ ! -d "../node_modules" ]; then
  echo "node_modules folder not found. Running npm install..."
  npm install
  if [ $? -ne 0 ]; then
    echo "npm install failed, exiting."
    exit 1
  fi
fi

COMMAND="node --expose-gc --trace-deprecation --max-old-space-size=2048 ../src/index.js"

while true; do
  echo "Starting command: $COMMAND"
  $COMMAND
  EXIT_CODE=$?
  echo "Command crashed with exit code ${EXIT_CODE}. Restarting in 1 second..."
  sleep 1
done