#!/bin/bash
set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Setting up your project...${NC}"

# Check for Docker and Docker Compose
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Create .env file for backend if it doesn't exist
if [ ! -f apps/backend/.env ]; then
    echo -e "${BLUE}Creating sample .env file for backend...${NC}"
    cat > apps/backend/.env << EOL
# Database Configuration
DB_HOST=database
DB_PORT=5432
DB_USERNAME=user
DB_PASSWORD=password
DB_DATABASE=mydb

# API Configuration
PORT=5000
NODE_ENV=development

# Add other environment variables as needed
EOL
    echo -e "${GREEN}✅ Created sample .env file for backend${NC}"
fi

# Build and start the containers
echo -e "${BLUE}Building and starting Docker containers...${NC}"
docker-compose up -d --build

echo -e "${GREEN}✅ Setup complete! Your application is now running.${NC}"
echo -e "${BLUE}Frontend: http://localhost:3000${NC}"
echo -e "${BLUE}Backend API: http://localhost:5000${NC}"
echo -e "${BLUE}Database: localhost:5432${NC}"
echo ""
echo -e "To view logs: ${BLUE}docker-compose logs -f${NC}"
echo -e "To stop the application: ${BLUE}docker-compose down${NC}"
