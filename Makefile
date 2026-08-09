.PHONY: install build test test-solidity test-backend test-all deploy verify clean dev demo

# ConsentFlow Makefile — convenience targets for development and CI

install: install-contracts install-backend install-frontend

install-contracts:
	foundry install # installs OpenZeppelin if not present

install-backend:
	cd backend && npm install

install-frontend:
	cd frontend && npm install

build: build-contracts build-frontend

build-contracts:
	forge build

build-frontend:
	cd frontend && npm run build

test: test-all

test-solidity:
	forge test --force

test-backend:
	cd backend && node test/api.test.js

test-all: test-solidity test-backend
	@echo "All tests complete."

deploy:
	@bash scripts/deploy.sh

verify:
	forge script script/VerifyDeployment.s.sol --rpc-url $(MONAD_RPC_URL)

dev:
	@bash scripts/dev.sh

demo:
	@bash scripts/demo.sh

clean:
	forge clean
	rm -rf frontend/dist frontend/node_modules/.vite
