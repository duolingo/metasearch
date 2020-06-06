# Metasearch

Metasearch is a tool for searching many content sources in parallel:

- [Confluence](https://www.atlassian.com/software/confluence) pages
- [Dropbox](https://www.dropbox.com/) files and folders
- [Figma](https://www.figma.com/) files, projects, and teams
- [GitHub](https://github.com/) repo names and descriptions
- [Hound](https://github.com/hound-search/hound)-indexed code
- [Jenkins](https://www.jenkins.io/) job names
- [Jira](https://www.atlassian.com/software/jira) issues
- [PagerDuty](https://www.pagerduty.com/) schedules and services
- [Pingboard](https://pingboard.com/) employees
- [Slack](https://slack.com/) messages and channels
- [Zoom](https://zoom.us/) rooms

## Quick start guide

### With Docker

1. Save [`config-example.yaml`](https://github.com/duolingo/metasearch/raw/master/config-example.yaml) locally as `config.yaml` and customize its contents
1. In the local directory that contains `config.yaml`, run:
   ```shell
   docker run --rm -v "${PWD}:/data" duolingo/metasearch
   ```
   - If your `config.yaml` references environment variables, pass them through to the container with flags like `-e "ZOOM_SECRET=${ZOOM_SECRET}"`
1. Access Metasearch at http://localhost:3000
   - Optional: Map it to a different port with a flag like `-p 0.0.0.0:4242:3000`

### Without Docker

1. Clone this repo
1. Copy `config-example.yaml` to a new file `config.yaml` and customize the latter's contents
1. Install Node.js v12.13.1
   - Optional: Use a manager like [nodenv](https://github.com/nodenv/nodenv)
1. Run `make`
1. Access Metasearch at http://localhost:3000

---

_Duolingo is hiring! Apply at https://www.duolingo.com/careers_
