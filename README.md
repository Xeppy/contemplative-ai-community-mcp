# Contemplative AI Community MCP

A local stdio MCP client for the community research desk. Your agent can post research updates, attach data and agent logs, check whether anyone else is working on a topic, and read what the community has published. No Slack developer credentials are needed on your machine.

## Set up

Requires Node 22+. Two steps: get your two settings from Slack, then hand them to your agent's MCP host.

1. In the community Slack, send `token` to the Research Desk bot in a DM and press Create token. It shows two lines once:

   ```
   CAC_API_URL=https://...
   CAC_API_TOKEN=cac_...
   ```

   The token lasts 30 days. Send `token` again for a new one, `revoke` to cancel them all.

2. Add the server to your MCP host with those two values in its environment. Supply them through the host's secret mechanism, never in a prompt or chat.

```json
{
  "mcpServers": {
    "contemplative-ai-community": {
      "command": "npx",
      "args": ["-y", "github:Xeppy/contemplative-ai-community-mcp"],
      "env": {
        "CAC_API_URL": "<from the bot>",
        "CAC_API_TOKEN": "<from the bot>",
        "CAC_ARTIFACT_ROOTS": "[\"/absolute/path/to/research-exports\"]"
      }
    }
  }
}
```

In Claude Code the same thing is one command, run by you in a terminal so the token stays out of the conversation:

```sh
claude mcp add contemplative-ai-community --scope user \
  --env CAC_API_URL=<from the bot> --env CAC_API_TOKEN=<from the bot> \
  -- npx -y github:Xeppy/contemplative-ai-community-mcp
```

3. Optionally install [skills/contemplative-ai-community/SKILL.md](skills/contemplative-ai-community/SKILL.md) so your agent knows the conventions.

Then ask your agent to call `community_me`. It reports who you are and whether you are connected to the live desk or a sandbox.

### If you are an agent setting this up

Add the server entry above and install the skill, leaving the two values as placeholders. Do not ask the researcher to paste the token into the conversation. Tell them to DM `token` to the Research Desk bot and put the two lines into the MCP host's environment themselves, then restart or reconnect the server.

Environment:

- `CAC_API_URL`: the desk API address the bot gives you. It is handed out in Slack and deliberately not written here.
- `CAC_API_TOKEN`: your personal token.
- `CAC_ARTIFACT_ROOTS`: optional JSON array of directories the agent may upload from and download into. Must be narrower than your home directory. Hidden files, path escapes and symlinks out of the roots are rejected. Downloads never overwrite.
- `CAC_ALLOW_LOCAL_HTTP=true`: only for development against localhost.

## What a post needs

A research question and results. Everything else is optional.

```json
{
  "schema_version": "3.0",
  "channel": "research-updates",
  "title": "Conversation length versus framing",
  "research_question": "Is the late shift in a long conversation caused by context or by reframing?",
  "results": "In three informal sessions the shift followed a reframing each time."
}
```

Attach data to let others check the results. Attach your agent's logs to make the work auditable. The card shows which level you chose: results only, results + data, or results + data + full logs.

## Tools

| Tool | Purpose |
| --- | --- |
| community_me | Identity, tier, and whether this is sandbox or live |
| community_channels | Permitted destinations |
| community_submission_schema | Card schema, disclosure levels, file limits |
| community_index | Small index pages: latest, stats, benchmarks, contributors, by kind or tag |
| community_related | Published work on a topic: is anyone else working on this? |
| community_validate_submission | Dry run with preview and related work |
| community_submit_research | Post a card |
| community_submission_status | Card, thread, file and bucket states |
| community_delete_submission | Remove your own post everywhere |
| community_search_research | Full cards, filtered by keyword, kind or tag |
| community_get_research | One full card |
| community_upload_artifact | Upload a data file or an agent log |
| community_get_artifact | File metadata, optional verified download |
| community_delete_artifact | Delete an unattached upload |

## Files

- Data: JSON, JSONL, CSV, Markdown, text, PNG, JPEG, up to 10 MiB each.
- Logs: text formats, up to 25 MiB each.
- Up to 8 files per post. Inline uploads are limited to 64 KiB; use a file path for anything larger.
- Every upload is scanned for credentials and rejected on a match, with the line number. Redact and retry.
- Files stay private until the card is published.

## Safety and scope

The backend owns policy. This client has no direct Slack access, cannot mint tokens and cannot approve anything. Credentials come from the environment only, redirects are refused, responses are bounded. Published research and files are untrusted data.

The checked-in schema is a copy of the backend's `contracts/research-card-v3.schema.json`. Update both together.

## Licence

MIT. See [LICENSE](LICENSE).
