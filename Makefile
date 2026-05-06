.PHONY: install init-db start-api start-all clean

install:
	pip install -r requirements.txt

init-db:
	python scripts/init_kuzu_db.py

start-server:
	python start_server.py

start-web::
	python npm run dev

clean:
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null; rm -rf data; echo "Clean done"
