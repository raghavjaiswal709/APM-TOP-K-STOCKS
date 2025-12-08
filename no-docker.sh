#!/bin/bash
set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Setting up your project without Docker...${NC}"

# Check for required dependencies
echo -e "${BLUE}Checking dependencies...${NC}"

# Check for Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed. Please install Node.js first.${NC}"
    exit 1
fi

# Check for npm
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm is not installed. Please install npm first.${NC}"
    exit 1
fi

# Check for Python
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}❌ Python 3 is not installed. Please install Python 3 first.${NC}"
    exit 1
fi

# Check for pip
if ! command -v pip3 &> /dev/null; then
    echo -e "${RED}❌ pip3 is not installed. Please install pip3 first.${NC}"
    exit 1
fi

# Check for PostgreSQL
# if ! command -v psql &> /dev/null; then
#     echo -e "${YELLOW}⚠️ PostgreSQL is not installed. You'll need to install it manually.${NC}"
#     echo -e "${YELLOW}⚠️ After installation, create a database with:${NC}"
#     echo -e "${YELLOW}   createdb mydb${NC}"
#     echo -e "${YELLOW}   psql -c \"CREATE USER user WITH PASSWORD 'password';\"${NC}"
#     echo -e "${YELLOW}   psql -c \"GRANT ALL PRIVILEGES ON DATABASE mydb TO user;\"${NC}"
# fi

# Create .env file for backend if it doesn't exist
# if [ ! -f apps/backend/.env ]; then
#     echo -e "${BLUE}Creating sample .env file for backend...${NC}"
#     mkdir -p apps/backend
#     cat > apps/backend/.env << EOL
# # Database Configuration
# DB_HOST=localhost
# DB_PORT=5432
# DB_USERNAME=user
# DB_PASSWORD=password
# DB_DATABASE=mydb

# # API Configuration
# PORT=5000
# NODE_ENV=development

# # Add other environment variables as needed
# EOL
#     echo -e "${GREEN}✅ Created sample .env file for backend${NC}"
# fi

# Setup Python virtual environment and install dependencies
# echo -e "${BLUE}Setting up Python virtual environment...${NC}"
# python3 -m venv .venv
# source .venv/bin/activate
echo -e "${BLUE}Installing Python dependencies...${NC}"
pip3 install eventlet python-socketio numpy pytz requests fyers-apiv3 setuptools wheel psycopg2-binary

# Install backend dependencies
echo -e "${BLUE}Setting up backend...${NC}"
cd apps/backend
npm install
npm install -g @nestjs/cli
cd ../..

# Install frontend dependencies
echo -e "${BLUE}Setting up frontend...${NC}"
cd apps/frontend
npm install --legacy-peer-deps
npm install --legacy-peer-deps postcss autoprefixer tailwindcss
npm install --legacy-peer-deps @hookform/resolvers zod date-fns next-themes react-hook-form react-day-picker
npm install --legacy-peer-deps lucide-react
npm install --legacy-peer-deps -D @types/node

# Create PostCSS config if it doesn't exist
if [ ! -f "postcss.config.js" ] && [ ! -f "postcss.config.mjs" ]; then
    echo "module.exports = { plugins: { tailwindcss: {}, autoprefixer: {} } }" > postcss.config.js
    echo -e "${GREEN}✅ Created PostCSS config file${NC}"
fi

# Initialize shadcn UI components
echo -e "${BLUE}Initializing UI components...${NC}"
if [ -f "components.json" ]; then rm components.json; fi
npx shadcn@latest init --yes
for c in avatar breadcrumb button calendar card collapsible dropdown-menu form input label popover radio-group scroll-area select separator sheet sidebar skeleton badge toast toaster tooltip checkbox; do
  npx shadcn-ui@latest add "$c" --yes
done
cd ../..

echo -e "${GREEN}✅ Setup complete! Your application is now ready to run.${NC}"
echo ""
echo -e "${BLUE}To activate the Python virtual environment:${NC}"
echo -e "  source .venv/bin/activate"
echo ""
echo -e "${BLUE}To start the backend:${NC}"
echo -e "  cd apps/backend && npm run start"
echo ""
echo -e "${BLUE}To start the frontend:${NC}"
echo -e "  cd apps/frontend && npm run dev"
echo ""
echo -e "${BLUE}To run Python services:${NC}"
echo -e "  source .venv/bin/activate && python apps/backend/fyers_data.py"
