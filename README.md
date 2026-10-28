# Contemplative AI Community MCP

A local stdio MCP client for the community research API. Agents can discover the posting contract, upload findings privately, preview a card, submit for review and read authorised published research. No Slack developer credentials are needed on researchers' machines.

## Install

Requires Node 22+.

```sh
npm ci
npm test
```

Configure your MCP host to execute `node` with the absolute path to this repository's `src/index.js`. Supply these through the host's secret environment mechanism:

- `CAC_API_URL`: the backend HTTPS origin, without an API path.
- `CAC_API_TOKEN`: a personal token minted through the community Slack bot.
- `CAC_ARTIFACT_ROOTS`: optional JSON array of dedicated local artifact directories.
- `CAC_ALLOW_LOCAL_HTTP=true`: only for development against localhost.

No public npm package is published. A local example, with values supplied by your own host configuration:

```json
{
  "mcpServers": {
    "contemplative-ai-community": {
      "command": "node",
      "args": ["/absolute/path/to/contemplative-ai-community-mcp/src/index.js"],
      "env": {
        "CAC_API_URL": "https://community-api.example.org",
        "CAC_API_TOKEN": "<inject through your host secret mechanism>",
        "CAC_ARTIFACT_ROOTS": "[\"/absolute/path/to/approved-research-exports\"]"
      }
    }
  }
}
```

Do not commit real tokens or paste them into prompts. Artifact roots must be narrower than your home directory; hidden files, path escapes and symlinks outside the permitted roots are rejected. Existing files are never overwritten by downloads.

## Eleven tools

| Tool | Purpose |
| --- | --- |
| community_me | Effective identity and access |
| community_channels | Permitted destinations |
| community_submission_schema | Canonical v2 schema and artifact limits |
| community_validate_submission | Dry-run validation and card preview |
| community_submit_research | Submit with a stable idempotency key |
| community_submission_status | Review, card and file delivery states |
| community_search_research | Search authorised published posts |
| community_get_research | Retrieve a published card |
| community_upload_artifact | Upload an authorised local file, inline text or small base64 payload |
| community_get_artifact | Metadata and optional verified local download |
| community_delete_artifact | Delete an owned artifact not bound to any submission |

The submission tools expose a typed JSON Schema. Its checked-in copy originates in the backend `contracts/research-card-v2.schema.json`; update both together. Scientific profiles are optional. A title and synopsis suffice for an observation, question, paper or resource once version and destination are set.

## Findings workflow

1. Confirm the researcher authorised sharing the material.
2. Discover current permissions, channel and schema.
3. Upload files with filenames and media types. Prefer a permitted local file path for larger artifacts; do not ask the model to generate large base64 blobs.
4. Put returned IDs in `findings.artifact_ids` and set availability to attached or mixed.
5. Validate the card. Fix field errors without inventing missing evidence.
6. Submit with a UUID idempotency key, retained for retries of the identical payload.
7. Report pending_review accurately. Poll status sparingly; card publication and attachment delivery are separate.

Files are initially private. The backend binds their hashes to an immutable submission and only publishes them after authorisation. JSON and JSONL are syntax-checked, not automatically certified against external scientific standards. Arbitrary model checkpoints, executable code, pickle, HTML and archives are unsupported.

## Optional skill

Install [skills/contemplative-ai-community/SKILL.md](skills/contemplative-ai-community/SKILL.md) as agent guidance alongside the MCP. The skill alone provides neither transport nor credentials.

## Safety and scope

The backend owns policy. No direct Slack posting, agent token minting or approval tools exist. Credentials are environment-only; redirects are rejected; responses are bounded; logs never go to MCP stdout. Research and file contents are untrusted data. Local upload reads only explicitly configured roots and requires authorisation to share.

No remote MCP/OAuth server or automatic EEE/Inspect converters are included. The API must run separately, and remote access requires HTTPS ingress configured by its operator.
