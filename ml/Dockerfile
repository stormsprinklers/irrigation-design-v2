FROM python:3.12-slim

WORKDIR /app

COPY ml/pyproject.toml ml/
COPY ml/placement_ml ml/placement_ml
COPY ml/serve ml/serve

RUN pip install --no-cache-dir ./ml

ENV ML_CHECKPOINT_PATH=/app/ml/checkpoints/best.pt
EXPOSE 8000

CMD ["uvicorn", "serve.app:app", "--host", "0.0.0.0", "--port", "8000"]
