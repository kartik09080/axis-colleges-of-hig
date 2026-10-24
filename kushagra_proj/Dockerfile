# Axis Drive - container image for the cloud (Render, Railway, Fly.io, or any Docker host)
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DRIVE_DATA_DIR=/data \
    PORT=8000

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Uploaded files and the database live in /data. Mount a persistent disk there.
RUN mkdir -p /data
VOLUME ["/data"]

EXPOSE 8000

# One worker (login limits and the secret key are per process); several threads for parallel requests.
# The long timeout lets large video uploads finish.
CMD ["sh", "-c", "exec gunicorn --workers 1 --threads 8 --timeout 600 --bind 0.0.0.0:${PORT} app:app"]
