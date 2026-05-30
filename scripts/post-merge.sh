#!/bin/bash
set -e

# Install root dependencies (React app)
npm install --legacy-peer-deps

# Install server dependencies
cd server && npm install && cd ..
