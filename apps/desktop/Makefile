.PHONY: install build dev start clean typecheck lint

# Install dependencies
install:
	npm install

# Build the application
build:
	npm run build

# Start in development mode (hot reload)
dev:
	npm run dev

# Start production build
start:
	npm run start

# Run type checking
typecheck:
	npm run typecheck

# Clean build artifacts
clean:
	rm -rf out dist node_modules/.cache

# Build and start
run: build start

# Full rebuild (clean + install + build)
rebuild: clean install build
