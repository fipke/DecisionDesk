.PHONY: help db-start db-stop db-restart db-logs db-clean backend-run backend-test mobile-install mobile-run setup clean

# Default target
help:
	@echo "DecisionDesk - Available commands:"
	@echo ""
	@echo "Database (PostgreSQL on port 5435):"
	@echo "  make db-start       - Start PostgreSQL container"
	@echo "  make db-stop        - Stop PostgreSQL container"
	@echo "  make db-restart     - Restart PostgreSQL container"
	@echo "  make db-logs        - Show PostgreSQL logs"
	@echo "  make db-clean       - Stop and remove PostgreSQL data volume"
	@echo ""
	@echo "Backend (Spring Boot):"
	@echo "  make backend-run    - Start backend server"
	@echo "  make backend-test   - Run backend tests"
	@echo ""
	@echo "Mobile (Expo/React Native):"
	@echo "  make mobile-install - Install mobile dependencies"
	@echo "  make mobile-run     - Start Expo development server"
	@echo ""
	@echo "Setup & Cleanup:"
	@echo "  make setup          - Initial setup (DB + backend env)"
	@echo "  make clean          - Stop all services"

# Database targets
db-start:
	@echo "Starting PostgreSQL on port 5435..."
	podman-compose up -d postgres

db-stop:
	@echo "Stopping PostgreSQL..."
	podman-compose stop postgres

db-restart:
	@echo "Restarting PostgreSQL..."
	podman-compose restart postgres

db-logs:
	@echo "PostgreSQL logs (Ctrl+C to exit):"
	podman-compose logs -f postgres

db-clean:
	@echo "WARNING: This will delete all PostgreSQL data!"
	@read -p "Are you sure? [y/N] " -n 1 -r; \
	echo; \
	if [[ $$REPLY =~ ^[Yy]$$ ]]; then \
		podman-compose down -v; \
	fi

# Backend targets
backend-run:
	@echo "Starting backend on http://localhost:8080..."
	cd apps/backend && ./mvnw spring-boot:run

backend-test:
	@echo "Running backend tests..."
	cd apps/backend && ./mvnw test

# Mobile targets
mobile-install:
	@echo "Installing mobile dependencies..."
	cd apps/mobile && npm install

mobile-run:
	@echo "Starting Expo development server..."
	cd apps/mobile && npx expo start --ios

# Setup & Cleanup
setup:
	@echo "Setting up DecisionDesk..."
	@echo "1. Starting PostgreSQL..."
	@$(MAKE) db-start
	@echo ""
	@echo "2. Setting up backend environment..."
	@if [ ! -f apps/backend/.env ]; then \
		cp apps/backend/.env.example apps/backend/.env; \
		echo "Created apps/backend/.env - Please add your OPENAI_API_KEY"; \
	else \
		echo "apps/backend/.env already exists"; \
	fi
	@echo ""
	@echo "Setup complete! Next steps:"
	@echo "  1. Add OPENAI_API_KEY to apps/backend/.env"
	@echo "  2. Run 'make backend-run' to start the backend"
	@echo "  3. Run 'make mobile-install && make mobile-run' for the iOS app"

clean:
	@echo "Stopping all services..."
	@$(MAKE) db-stop
	@echo "All services stopped"
