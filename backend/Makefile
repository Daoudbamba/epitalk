DOCKER_IMAGE_NAME=backend:latest

.PHONY: build docker-build up down logs shell

build:
	cargo build --release

docker-build:
	docker build -t $(DOCKER_IMAGE_NAME) .

up:
	docker-compose up --build -d

down:
	docker-compose down

logs:
	docker-compose logs -f

shell:
	docker-compose exec backend /bin/bash
