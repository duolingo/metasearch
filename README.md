# Metasearch

Metasearch is a tool for searching many content sources in parallel:

- Confluence pages
- Dropbox files and folders
- GitHub repo names and descriptions
- [Hound](https://github.com/hound-search/hound)-indexed code
- Jenkins job names
- Jira issues
- Zoom rooms

## Quick start guide

### With Docker

1. Save `config-example.yaml` locally as `config.yaml` and customize its contents
1. In the directory that contains `config.yaml`, run:
   ```shell
   docker run --rm -v "${PWD}:/data" duolingo/metasearch
   ```
   - If your `config.yaml` references environment variables, pass them through to the container with flags like `-e "ZOOM_SECRET=${ZOOM_SECRET}"`
1. Access Metasearch at http://localhost:3000
   - Optional: Map it to a different port with a flag like `-p 0.0.0.0:4242:3000`

### Without Docker

1. Clone this repo
1. Copy `config-example.yaml` to `config.yaml` and customize its contents
1. Install Node.js v12.13.1
   - Optional: Use a manager like [nodenv](https://github.com/nodenv/nodenv)
1. Run `make`
1. Access Metasearch at http://localhost:3000

---

_Duolingo is hiring! Apply at https://www.duolingo.com/careers_
