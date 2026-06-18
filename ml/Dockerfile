FROM python:3.12-slim

WORKDIR /app

COPY ml/pyproject.toml ml/
COPY ml/placement_ml ml/placement_ml
COPY ml/serve ml/serve
COPY ml/scripts/start.sh ml/scripts/start.sh

RUN chmod +x ml/scripts/start.sh \
  && pip install --no-cache-dir ./ml

# Mount a Railway volume at /app/ml/checkpoints with best.pt, or bake in at build time.
ENV ML_CHECKPOINT_PATH=/app/ml/checkpoints/best.pt
ENV PORT=8000

EXPOSE 8000

CMD ["/app/ml/scripts/start.sh"]
