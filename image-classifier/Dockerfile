FROM python:3.11-slim

WORKDIR /app

# Install CPU-only torch/torchvision first to avoid the ~2 GB CUDA download
RUN pip install --no-cache-dir torch torchvision --index-url https://download.pytorch.org/whl/cpu

COPY requirements.txt .
RUN pip install --no-cache-dir flask pillow gunicorn

COPY server.py weighting.pth ./

EXPOSE 6000

CMD ["gunicorn", "--workers=1", "--bind=0.0.0.0:6000", "--timeout=120", "server:app"]
