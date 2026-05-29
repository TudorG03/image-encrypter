# Distributed and Parallel Systems Security - Image Encrypter

## By Gheorghiu Calin-Tudor

A five-container distributed system that encrypts and decrypts BMP images with AES, distributing chunks across nodes with OpenMPI and parallelising the cipher work per node with OpenMP. Submissions, results, and lifecycle events flow over a RabbitMQ message broker; results are persisted to MySQL and exposed for download via a Node.js service.

## Architecture

```
                      ┌──────────────┐
                      │  Browser     │
                      │  Next.js UI  │
                      └──────┬───────┘
                             │  HTTPS-ish (8080)
                             │  REST + SSE
                             ▼
        ┌───────────────────────────────────────┐
        │ C01  Spring Boot API + Next.js frontend
        │  - JWT auth
        │  - POST /api/jobs/submit  (multipart)
        │  - SSE /api/jobs/{id}/stream
        │  - publishes image-job messages
        │  - subscribes to job.done topic
        └────────┬──────────────────────────┬───┘
                 │ publish image.process    │ subscribe job.done
                 ▼                          ▲
        ┌──────────────────────────────────────────────┐
        │ C02  RabbitMQ broker                         │
        │  - image.exchange (direct) ─► image.queue    │
        │  - job.events.exchange (topic) ─► job.done.queue
        └────────┬──────────────────────────▲──────────┘
                 │ image.process            │ job.done
                 ▼                          │
        ┌──────────────────────┐            │
        │ C03  Apache TomEE    │            │
        │  - consumes image.queue           │
        │  - launches native ELF64 via mpirun
        │  - uploads result to C05          │
        │  - publishes job.done event ──────┘
        └────────┬─────────────┘
                 │  mpirun -np 2 --host c03,c04
                 │  SSH key-based, OpenSSH
                 ▼
        ┌──────────────────────┐
        │ C04  Worker          │
        │  - sshd only         │
        │  - runs encrypt_decrypt over MPI
        │    + OpenMP per-node parallelism
        └──────────────────────┘

        ┌────────────────────────────────────────┐
        │ C05  Node.js + MySQL + MongoDB         │
        │  - POST /image  (BLOB upload)          │
        │  - GET  /image/:id  (download)         │
        │  - GET  /snmp, /snmp/latest            │
        │  - internal /users, /jobs (X-Internal-Secret)
        └────────────────────────────────────────┘
```

## Stack

| Container | Role                                                        | Stack                                                                                         |
| --------- | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| C01       | Frontend + REST API gateway + JMS publisher + done-listener | Next.js 15 / React 19 / Tailwind, Spring Boot 4 (Java 25), Spring Security + JWT, Spring AMQP |
| C02       | Message broker                                              | RabbitMQ 4.x, management plugin, AMQP 0.9.1                                                   |
| C03       | JMS subscriber, MPI launcher, done-publisher                | Apache TomEE Plume 10.0-M3, RabbitMQ Java client, native `mpirun`                             |
| C03 + C04 | Parallel cipher workers                                     | C, OpenMPI 5 + OpenMP, OpenSSL EVP, key-based SSH between nodes                               |
| C05       | Data layer + REST                                           | Node.js 22 / Express, MySQL 8, MongoDB 7, `net-snmp`                                          |
| redis     | Pub/sub for SSE fan-out                                     | Redis 7                                                                                       |

Base image (for C01–C05): `critoma/amd64_u24_noble_ism_security` (x86-64 Ubuntu 24 LTS).

## Data flow for a single job

1. User submits a BMP + AES params from the frontend.
2. C01 verifies JWT, persists job metadata in C05 (MySQL `jobs`), and publishes a message to `image.exchange` with routing key `image.process`. Body is JSON with the base64-encoded image plus operation/mode/key/IV.
3. C03 consumes from `image.queue`, decodes, writes the BMP to a temp file, and runs `mpirun --host c03,c04 -np 2 /mpi/encrypt_decrypt …`.
4. The native binary distributes the BMP pixel data across MPI ranks and parallelises AES per node with OpenMP. The output BMP is written back to the shared `mpi_volume`.
5. C03 reads the output and POSTs it to C05 as `application/octet-stream`. C05 stores it as a `LONGBLOB` in `processed_images`.
6. C03 publishes `{"jobId": …, "downloadUrl": …}` to `job.events.exchange` with routing key `job.done`.
7. C01's `@RabbitListener` on `job.done.queue` receives the event, marks the job `done` in C05, and publishes the URL on a per-job Redis channel.
8. The user's open SSE stream (`/api/jobs/{id}/stream`) emits a `done` event with the C05 download URL. The frontend renders a download link.

## Prerequisites

- Docker Engine with Compose v2
- An x86-64 Linux/macOS/Windows host. On Apple Silicon you will need to either run via Rosetta emulation or swap MongoDB into its own container (see CLAUDE.md).
- About 4 GB of free RAM for the full stack.
- Free ports: `3000` (frontend), `8080` (API), `3001` (C05), `15672` (RabbitMQ management UI).

## Quick start

```bash
# from the repo root
docker compose up --build
```

First boot takes a few minutes (Maven dependency download, npm install, native compile of `encrypt_decrypt.c` with `mpicc -fopenmp`). Subsequent boots are cached.

When you see `Started C01Application` in the C01 logs, browse to:

- Frontend: <http://localhost:3000>
- REST API: <http://localhost:8080>
- C05 image/SNMP API: <http://localhost:3001>
- RabbitMQ UI: <http://localhost:15672> (login `admin` / `admin`)

To tear down:

```bash
docker compose down               # keep volumes (MySQL data persists)
docker compose down -v            # drop volumes too
```

## Using the application

### Through the browser

1. Open <http://localhost:3000> and register a user on the `/auth` page (username + password).
2. On the dashboard, select:
   - **BMP file** — any `.bmp`, up to ~1 MB by default (Spring Boot's multipart cap).
   - **Operation** — `encrypt` or `decrypt`.
   - **Cipher mode** — `ECB`, `CBC`, `CFB`, `OFB`, or `CTR`.
   - **Key** — 64 hex chars (AES-256). Click **Generate** for a random one.
   - **IV** — 32 hex chars. Required for every mode except `ECB`. **Generate** also available.
3. Submit. A status card appears with a spinner; when the worker is done the SSE stream delivers a download link.
4. Past jobs and their results are listed at the bottom of the dashboard.

### Through the API

```bash
# 1. Register (or use an existing account)
TOKEN=$(curl -s -X POST http://localhost:8080/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"username":"alice","password":"secret"}' | jq -r .token)

# 2. Submit a job
JOB=$(curl -s -X POST http://localhost:8080/api/jobs/submit \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/path/to/picture.bmp" \
  -F "operation=encrypt" \
  -F "mode=CBC" \
  -F "keyHex=$(openssl rand -hex 32)" \
  -F "ivHex=$(openssl rand -hex 16)" | jq -r .jobId)

# 3. Wait for the SSE done event
curl -N "http://localhost:8080/api/jobs/$JOB/stream"
# → event:done
#   data:http://c05:3001/image/42

# 4. List your jobs
curl -H "Authorization: Bearer $TOKEN" http://localhost:8080/api/jobs | jq

# 5. Download a result. C05 is exposed on localhost:3001;
#    rewrite the host accordingly.
curl -o result.bmp http://localhost:3001/image/42
```

### Monitoring SNMP metrics

C05 polls SNMP from every container every 30 s and stores it in MongoDB. The dashboard has an **SNMP Metrics** link, or you can query directly:

- `GET http://localhost:3001/snmp?limit=100` – recent readings, newest first
- `GET http://localhost:3001/snmp/latest` – one row per node

> SNMP collection is optional in the spec and not part of the graded scope.

## AES parameter rules

| Mode                  | IV                                | Key                     |
| --------------------- | --------------------------------- | ----------------------- |
| ECB                   | not used                          | 64 hex chars (32 bytes) |
| CBC / CFB / OFB / CTR | required, 32 hex chars (16 bytes) | 64 hex chars            |

The native worker validates lengths and rejects malformed input.

## REST endpoints

### C01 — public

| Method | Path                    | Notes                                                          |
| ------ | ----------------------- | -------------------------------------------------------------- |
| POST   | `/api/auth/register`    | `{username, password}` → `{token}`                             |
| POST   | `/api/auth/login`       | `{username, password}` → `{token}`                             |
| POST   | `/api/jobs/submit`      | multipart: `file`, `operation`, `mode`, `keyHex`, `ivHex?`     |
| GET    | `/api/jobs`             | list current user's jobs                                       |
| GET    | `/api/jobs/{id}/stream` | SSE; emits one `done` event with the download URL, then closes |

All `/api/jobs/**` routes (except `…/stream`) require `Authorization: Bearer <jwt>`.

### C05 — public

| Method | Path                                           | Notes                                      |
| ------ | ---------------------------------------------- | ------------------------------------------ |
| GET    | `/health`                                      | liveness                                   |
| POST   | `/image?job_id=&operation=&mode=&aes_key=&iv=` | body: `application/octet-stream` BMP bytes |
| GET    | `/image/:id`                                   | downloads the BMP as `image/bmp`           |
| GET    | `/snmp?limit=`                                 | recent SNMP rows                           |
| GET    | `/snmp/latest`                                 | latest row per node                        |

### C05 — internal (require `X-Internal-Secret`)

| Method | Path               | Notes                                                   |
| ------ | ------------------ | ------------------------------------------------------- |
| POST   | `/users`           | create user (used by C01 register)                      |
| GET    | `/users/:username` | fetch user with password hash                           |
| POST   | `/jobs`            | create job row (used by C01 submit)                     |
| PATCH  | `/jobs/:jobId`     | update status + downloadUrl (used by C01 done-listener) |
| GET    | `/jobs?user_id=`   | list jobs for a user                                    |

## Messaging topology (C02)

Declared statically via `c02/definitions.json`.

| Exchange              | Type   | Routing key     | Queue            | Consumer                                  |
| --------------------- | ------ | --------------- | ---------------- | ----------------------------------------- |
| `image.exchange`      | direct | `image.process` | `image.queue`    | C03 `JobConsumer` (raw RabbitMQ client)   |
| `job.events.exchange` | topic  | `job.done`      | `job.done.queue` | C01 `JobDoneListener` (`@RabbitListener`) |

The image-processing path uses a queue because work is exclusive to one C03. The job-done path uses a topic because completion is naturally pub/sub — C01 listens today, future SNMP/audit/metrics consumers can subscribe without changing publishers.

## Persistence

- **MySQL** (`c05`, database `imagesdb`):
  - `users(id, username, password_hash)`
  - `jobs(id, job_id, user_id, operation, mode, key_hex, iv_hex, status, download_url, created_at)`
  - `processed_images(id, job_id, operation, mode, iv, aes_key, image_data LONGBLOB, created_at)`
- **MongoDB** (`c05`, database `metricsdb`): `snmp_metrics` collection. Indexed on `{node, timestamp}`.
- **Redis** (`redis` container): in-memory only; per-job channels `job:{jobId}` for SSE fan-out.
- **`mpi_volume`** Docker volume: shared between c03 and c04 so MPI ranks see the same `/mpi/encrypt_decrypt` binary.
- **`mysql_data`** Docker volume: MySQL data persists across `docker compose down` (not `down -v`).

## Project layout

```
.
├── compose.yaml          # five services + redis + two volumes
├── c01/                  # Spring Boot backend + Next.js frontend in one image
│   ├── backend/          # Maven project, Spring Boot 4
│   ├── frontend/         # Next.js 15 app
│   └── Dockerfile        # multi-stage: builds frontend, then backend
├── c02/                  # RabbitMQ + definitions.json (declarative topology)
├── c03/                  # TomEE webapp + native C source
│   ├── c03/              # Maven WAR project (servlet + JMS consumer + MPI launcher)
│   └── encrypt_decrypt.c # OpenMPI + OpenMP + OpenSSL EVP
├── c04/                  # sshd-only worker (key-based)
├── c05/                  # Express app + MySQL + MongoDB via supervisord
├── mpi-keys/             # SSH key pair for c03↔c04
├── requirements.md       # course brief
└── architecture.drawio   # high-level diagram
```

## Environment variables

Defaults are baked into `compose.yaml`; override by exporting before `docker compose up`.

| Var               | Default                                | Used by                                            |
| ----------------- | -------------------------------------- | -------------------------------------------------- |
| `INTERNAL_SECRET` | `changeme-internal-secret`             | C01, C05 — gates C05's internal endpoints          |
| `JWT_SECRET`      | `changeme-32-char-secret-for-hmac-256` | C01 — HMAC-SHA256 signing key (must be ≥ 32 chars) |
| `RABBITMQ_HOST`   | `c02`                                  | C01, C03                                           |
| `C05_HOST`        | `c05`                                  | C01, C03                                           |
| `REDIS_HOST`      | `redis`                                | C01                                                |

For anything beyond local development, replace both default secrets.
