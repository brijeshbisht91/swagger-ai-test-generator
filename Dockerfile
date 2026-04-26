FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY swagger_ai_graph.py swagger.json ./
COPY java-tests ./java-tests

ENV OLLAMA_HOST=http://ollama:11434

CMD ["python", "swagger_ai_graph.py"]
