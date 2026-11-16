---
name: create-container
description: Add a new container to a project built from this devcontainer template — an app service (API, front-end, worker) or shared infrastructure (database, cache, queue, search) — following the naming rules that keep Docker Desktop and `docker compose ls` listing everything under the one project group. Use whenever adding or renaming a compose service, Dockerfile, named volume, network or dev container.
---

# Create a container

`capitalwise` is the template's placeholder project slug and `marcusnguyen` its registry
owner. In a lifted project both have already been replaced (README →
*Lifting it into a new project*); read them as "the project's slug" below.

Nothing here assumes a particular database or framework. Pick the image the
project needs; the naming and wiring stay the same.

---

## 1. Naming — the part that decides where Docker lists it

Docker Desktop, `docker compose ls` and `docker ps` group containers by
**compose project**. The project name comes from the top-level `name:` in the
compose file. Without it, compose falls back to the *folder* name — so
`api/docker-compose.yml` becomes project `api`, the dev container becomes
`api_devcontainer`, and the stack scatters across three groups.

| Thing | Rule | Dev result | Prod result |
| --- | --- | --- | --- |
| Compose project | `name: capitalwise` as the first key of **every** compose file, `.devcontainer/docker-compose.yml` overlays included | one group, `capitalwise` | one group, `capitalwise` |
| Service key | kebab-case. App service = its folder name. Infrastructure = its **role** (`db`, `cache`, `queue`, `search`, `mail`), never the product (`postgres`) | container `capitalwise-api-1`, `capitalwise-db-1` | `capitalwise-api-1` (`capitalwise_api_1` under podman-compose) |
| In-network hostname | the service key — nothing to configure | `api`, `db` | same |
| Built image | `capitalwise/<service>:dev` | `capitalwise/api:dev` | `ghcr.io/marcusnguyen/capitalwise-<service>:latest` |
| Pulled image | official image, **pinned major**, never `:latest` | `postgres:17` | full path: `docker.io/library/postgres:17` |
| Named volume | `<service>-<purpose>` — compose prefixes the project | `capitalwise_api-node-modules`, `capitalwise_db-data` | `capitalwise_db-data` |
| Network | key **and** `name:` are the project slug | `capitalwise` | `capitalwise-prod` |
| Dev container | `"capitalwise <Service> (<Framework>)"` | `capitalwise API (NestJS)` | — |
| Env vars | `<SERVICE>_` prefix, upper snake case | `API_PORT`, `DB_PORT`, `DB_PASSWORD` | same keys in `~/capitalwise/.env` |

Why a role name for infrastructure: swapping Postgres for MySQL then changes
the `image:` line and nothing else — not the container name, the hostname every
app connects to, the volume, or the env vars.

**Never:**

- **`container_name:`** — it bypasses `<project>-<service>-<n>`, collides
  across projects on the same machine, and blocks `--scale`.
- **Leave `name:` off a file** — that file's containers land in a separate
  group named after the folder.
- **Rely on `-p` or `COMPOSE_PROJECT_NAME`** — they live in one shell; the
  file has to carry the name so VS Code and CI get it too.
- **`--remove-orphans`** — every file shares the project, so each sees the
  others' containers as orphans. That flag stops them. The *"Found orphan
  containers"* warning is expected; `COMPOSE_IGNORE_ORPHANS=true` silences it.
- **`external: true` on the network** — every file declares it with
  `name: capitalwise`, so whichever stack starts first creates it and start order
  never matters.

---

## 2. Adding an app service (API, front-end, worker)

Start from the closest stack folder in the template (`nodejs/api`,
`nodejs/front-end`, `python/api`, `java/api`, `csharp/api`) and copy it to
`<repo>/<service>/`. Then:

1. **Dockerfile** — keep the four targets in this order:
   `development | test | builder | production`. Production listens on **80**,
   `EXPOSE 80`, has `curl` for the healthcheck, and bakes in no env file.

2. **`<service>/docker-compose.yml`**:

   ```yaml
   name: capitalwise

   services:
     <service>:
       build:
         context: .
         dockerfile: Dockerfile
         target: development
       image: capitalwise/<service>:dev
       restart: unless-stopped
       working_dir: /workspaces/<service>
       command: sh -c "<install> && exec <dev server>"
       environment:
         PORT: <container port>
       ports:
         # Host side only — the container port is fixed.
         - "${<SERVICE>_PORT:-<default>}:<container port>"
       volumes:
         - ..:/workspaces:cached                              # repo root, so .git resolves
         - <service>-<deps>:/workspaces/<service>/<deps dir>  # deps never in the bind mount
       networks:
         - capitalwise

   volumes:
     <service>-<deps>:

   networks:
     capitalwise:
       name: capitalwise
       driver: bridge
   ```

3. **`<service>/.devcontainer/docker-compose.yml`** — the overlay. It needs the
   `name:` line too, or the dev container becomes its own project:

   ```yaml
   name: capitalwise

   services:
     <service>:
       command: sleep infinity
   ```

4. **`<service>/.devcontainer/devcontainer.json`** —
   `"name": "capitalwise <Service> (<Framework>)"`,
   `"dockerComposeFile": ["../docker-compose.yml", "docker-compose.yml"]`,
   `"service": "<service>"`, `"workspaceFolder": "/workspaces/<service>"`,
   `"shutdownAction": "none"`, and `forwardPorts` for the container port.

5. **`<service>/.env.example`** — `<SERVICE>_PORT=<default>`. Pick a default
   no other service in the repo uses.

6. **`docker-compose.prod.yml`** — add the service:
   `image: ghcr.io/marcusnguyen/capitalwise-<service>:latest`, publish only on
   `127.0.0.1:${<SERVICE>_PORT}:80`, a `curl` healthcheck, `networks: [capitalwise]`.
   If nginx routes to it, add a `location` to `server/nginx.conf.example` and
   the port to `PROTECTED` in `scripts/merge_env.py` and the copy inlined in
   `.github/workflows/deploy.yml`.

7. **CI** — add a build job with `context: ./<service>` that pushes
   `ghcr.io/marcusnguyen/capitalwise-<service>:latest`.

---

## 3. Adding shared infrastructure (database, cache, queue, ...)

Infrastructure lives in the **root** compose files, not inside an app folder,
because more than one app may use it.

1. **Root `docker-compose.yml`** (dev) — uncomment the `db` example, or add:

   ```yaml
   services:
     <role>:
       image: <image>:<pinned major>
       restart: unless-stopped
       environment:
         <IMAGE_PASSWORD_VAR>: ${<ROLE>_PASSWORD:-example}
       ports:
         # Off the default (default + 1) so a local install doesn't clash.
         - "${<ROLE>_PORT:-<default + 1>}:<container port>"
       volumes:
         - <role>-data:<data dir>
       networks:
         - capitalwise

   volumes:
     <role>-data:
   ```

2. **`docker-compose.prod.yml`** — same service, above the app services, with:
   full registry path on the image, **no `ports:`** (in-network only), a
   `healthcheck:`, credentials as `${<ROLE>_PASSWORD:?set it in ~/capitalwise/.env}`,
   and the volume declared. Give the consuming app
   `depends_on: { <role>: { condition: service_healthy } }`.

3. **Env** — dev port and credentials in root `.env.example`; real credentials
   in `server/env.example`; add the credential keys to `PROTECTED` in
   `scripts/merge_env.py` **and** `.github/workflows/deploy.yml`.

4. **Wire the apps** — each consuming app's compose `environment:` (dev and
   prod) gets the connection string using the **service key and container
   port**: `<role>:<container port>`, never `localhost`, never the host port.

5. **Docs** — add a row to the URL table in `LOCAL-DEV.md`.

---

## 4. Verify

```bash
docker compose ls
docker ps --filter label=com.docker.compose.project=capitalwise \
  --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}'
docker volume ls --filter label=com.docker.compose.project=capitalwise
docker network inspect capitalwise --format '{{range .Containers}}{{.Name}} {{end}}'
```

- `docker compose ls` shows **one** `capitalwise` row, with every compose file
  listed under CONFIG FILES.
- Every container is `capitalwise-<service>-<n>`, every volume `capitalwise_<service>-...`.
- A container under another project name means a file is missing `name:`;
  a container name without the `capitalwise-` prefix means `container_name:` slipped
  in.
