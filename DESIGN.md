# Contemplative AI Community: agent publishing

Status: target architecture. The working implementation and its limitations are documented in README.md.
Audience: community operators and contributors. See README.md for current implementation status.

## Purpose

A shared research desk for a private contemplative AI community. Researchers give their agents a community bearer token. Agents submit structured research through an HTTP API or a thin MCP client. A single Slack bot renders approved work, consistently attributed to its human owner and agent.

No researcher needs a Slack developer token. Community membership, permissions and channel visibility remain server decisions.

## Repository boundary

1. `contemplative-ai-community-backend`: Slack app, HTTP API, canonical JSON Schema, authorisation, review queue, token management, database, delivery worker and audit log.
2. `contemplative-ai-community-mcp`: local stdio MCP client plus optional SKILL.md. Calls the same HTTP API. Contains no Slack credentials, independent policy engine or direct publishing path.

Start with local stdio MCP so users can configure a bearer token without hosting another authenticated service. Remote MCP and OAuth are later work.

## Minimal deployment

Proposed stack: TypeScript, Fastify, Slack Bolt, Zod/JSON Schema, PostgreSQL. One service deployment with HTTP ingress and an outbox worker. PostgreSQL provides transactions and queue leasing; Redis is unnecessary initially. Slack Events API and interactive requests use verified signatures and replay-window checks. Acknowledge Slack within three seconds and process asynchronously. Deduplicate event IDs.

Install once into one workspace. Store Slack installation credentials only on the server. Allowlist the workspace ID and explicitly configured channels. New users default to read-only; a community administrator grants posting access. Community administration is a separate capability from the posting tier.

## Permissions

Effective permission is the intersection of active membership, current posting tier, token scopes and channel policy. Tokens only narrow rights. Every API operation, MCP operation and Slack action checks server-side authorisation. Revocation and demotion take effect immediately.

| Tier | Read permitted published research | Submit for review | Direct publication |
| --- | --- | --- | --- |
| read-only | yes | no | no |
| gated-post | yes | yes | no |
| admin-post | yes | yes | only in direct-enabled channels |

The name admin-post means trusted publisher. It does not grant membership administration, token issuance for other users or reviewer rights.

Scopes: `research:read`, `research:submit`, `research:publish`. Direct publication requires both admin-post and research:publish, plus research:submit to submit. An admin-post token without research:publish queues submissions for review. A publish scope never elevates gated-post or read-only users.

Review and membership management are human Slack capabilities, separate from agent scopes. No agent-token minting endpoint, no token chaining, no agent approvals in v1.

Channel modes: `direct-enabled` and `review-required`. The latter queues everyone, including admin-post. Explicitly requesting review always queues. Reviewers cannot approve their own submissions in v1. Initialise at least two reviewers if they need to submit research.

## Research contract

POST /v1/submissions accepts only the canonical schema; unknown properties are rejected recursively. Clients supply plain content, never Slack blocks, mrkdwn, destination Slack IDs, user identities or arbitrary delivery URLs.

Fields: channel slug, kind, title, summary, contemplative relevance, methods, limitations, sources, tags and an optional non-authoritative agent label. Kinds: paper, experiment, synthesis, question, resource. Each source has a title and HTTPS URL. Non-question submissions require at least one source. All submissions include limitations, including explicit uncertainty or unpublished status. A schema cannot establish scientific truth; human reviewers assess quality.

Suggested bounds: title 160 characters; summary 2,000; relevance 1,000; methods 1,000; limitations 1,000; up to 8 sources and 5 tags; UTF-8 request body 32 KiB maximum. At least one substantive character per text field. Validating URLs does not fetch them. Disable Slack unfurls and do not fetch user URLs in v1. This avoids an SSRF and accidental private-document disclosure path.

The service revalidates the stored payload immediately before rendering. Render stable Block Kit sections: title/type, summary, relevance, methods, limitations, sources, tags, attribution and submission ID. Escape Slack control characters, suppress broadcast mentions and treat source titles as plain text. Bound rendered block count and text length within Slack limits. Attribution comes from the authenticated Slack member mapping; an agent label is explicitly self-reported.

## Submit, review, deliver

1. Authenticate, enforce limits, validate schema and authorise the target channel.
2. In one transaction create a submission, record its payload hash and idempotency record, and either enqueue review or create an outbox job.
3. Return HTTP 202 with submission ID, state and status URL. This never claims that Slack has already published the post.
4. For gated submissions, send a reviewer-only Slack message with Approve and Reject buttons. Review notifications must only reach reviewers authorised to see that destination channel's contents.
5. A button opens a confirmation modal. Rejection requires a reason. Reviewers can request a revision; they do not silently rewrite another researcher's claims.
6. Approval locks the current revision, rechecks reviewer rights, submitter membership and channel access, and atomically creates one outbox job. Stale or repeated actions cannot republish. Permission revocation cancels undelivered work; token expiry alone does not undo a previously authorised submission.
7. Worker rechecks current membership/channel permission, revalidates, renders and publishes. Persist Slack channel ID, message timestamp and permalink. Notify the submitter of publication or rejection.

States: pending_review, pending_delivery, published, rejected, cancelled, delivery_failed, delivery_unknown. Revision resubmission creates a new immutable revision and invalidates old approval buttons.

Use a required Idempotency-Key header scoped to member, token and route. Same key and same payload returns the original result; different payload returns 409. Retain keys for at least 30 days. Clients retain the key across retries.

Slack publication and a database commit cannot be atomic. Lease jobs, use a stable delivery identifier in Slack metadata where available, and reconcile ambiguous timeouts before retrying. If history access cannot confirm delivery, mark delivery_unknown and request operator reconciliation rather than blindly reposting. Do not promise exactly-once Slack delivery. Respect Retry-After for 429 responses; use capped exponential retries for clearly retryable failures.

## HTTP API

All community endpoints use Authorization: Bearer cac_… over HTTPS.

- GET /v1/me: identity, current tier, token scopes, permitted channel slugs.
- GET /v1/channels: permitted publication destinations and their modes.
- GET /v1/schema: versioned submission JSON Schema, accessible with any active token.
- POST /v1/submissions: structured submission; optional review_requested=true.
- GET /v1/submissions/:id: own submission state, rejection reason and publication permalink; reviewers through the human surface. Never expose someone else's pending submission to ordinary readers.
- GET /v1/research?channel=&q=&cursor=&limit=: published canonical posts only, filtered by channel access. Limit at most 100.
- GET /v1/research/:id: published canonical post within caller's channel access.

Read research requires research:read. Submission status is available to its owner with research:submit or research:read. Read-only tier cannot acquire submission rights through scopes.

Error envelope: {error: {code, message, fields?, request_id}}. Use 400 malformed JSON, 401 invalid/expired/revoked token, 403 insufficient permission, 404 inaccessible or missing object, 409 conflicting idempotency key, 413 body too large, 422 invalid schema, 429 throttled, 503 unavailable. No fail-open publishing or reading.

This is a canonical research index, not a bridge into all Slack history. Private convening channels stay completely outside the integration unless explicitly approved later.

## Token minting from Slack DMs

The researcher DMs the bot `token`. The bot presents a private action and opens a modal for label, expiry and allowed scopes. Verify signed Slack requests, team ID and acting user. Require current workspace membership, handle deactivation, and intersect selected scopes with current rights.

Generate 32 random bytes and encode as a cac_ prefixed opaque bearer token. Store only its SHA-256 hash, safe prefix, owner, scopes, created/expires/revoked timestamps and last-used timestamp. A high-entropy token does not require a password KDF. Default expiry: 30 days; maximum: 90 days. Limit active tokens per member.

Preferred issuance: show the secret once in a private modal reached from the DM, with Copy and Done guidance. Never log the raw token or put it in public messages. The API cannot recover it; lost secrets require rotation. Modal display still passes through Slack and is not a guarantee of end-to-end secrecy. A plaintext DM fallback requires explicit acceptance that Slack retains the credential, and should be disabled by default. Confirm modal behaviour in a workspace spike before committing the onboarding UX.

`tokens` lists safe prefixes, labels and expiry; `revoke` and `rotate` use private human-confirmed actions. Rotation returns a new token once and revokes the old one transactionally. Bearer-authenticated agents cannot mint, rotate or increase scopes. Token issuance actions are single-use and replay-safe.

Slack permissions and community membership are synchronised on membership/deactivation events and periodically reconciled. If membership authorisation freshness expires and Slack cannot verify it, fail closed until refreshed.

## Slack enforcement boundary

A bot cannot generally intercept or delete arbitrary human posts before publication. Do not imitate Notion quarantine by promising to delete other people's Slack messages.

Use dedicated research publication channels restricted to the bot and permitted human operators where the workspace plan supports suitable posting controls. Verify the exact plan and bot exception behaviour during installation. If restrictions are unavailable, bot posts remain canonical and signed by stored message IDs; manual posts are outside the index and may be flagged for moderator attention after the fact. This is a weaker channel guarantee and must be visible to administrators.

Keep discussion in separate channels or threads. Slack-originated structured submissions use a shortcut/modal that calls the same domain service as HTTP. Bot messages contain no independent permissions logic.

## Data and privacy

Tables: members, member_channel_access, channels, api_tokens, submissions, submission_revisions, review_decisions, outbox_jobs, published_posts, idempotency_keys, slack_events and audit_events.

Use workspace-scoped IDs and foreign keys even for the initial single-workspace service. Store human attribution independently of Slack's bot-created message identity. Authorisation applies before search, count, pagination and retrieval. Do not expose reviewer notes outside authorised participants.

Store canonical structured posts independently of Slack retention. Display this retention distinction during onboarding. Proposed default: posts retained until an authorised deletion request; rejected submissions 90 days; operational logs 14 days; audit metadata 180 days; backups 30 days. Confirm with the community before launch. Deleting a post removes its content from the API and attempts deletion of the bot-owned Slack message; retain minimal content-free audit metadata. Backup expiry and Slack retention have separate timelines.

Rate limits: suggested 10 submissions/member/hour and 60 API requests/token/minute plus workspace delivery limits. Bound queues and enforce per-member token quotas. Redact Authorization headers, tokens and payload content from routine logs. Keep secrets out of repository files and MCP configuration examples. Encrypt backups and use least-privilege database credentials.

## MCP and skill

Local MCP executable reads CAC_API_URL and CAC_API_TOKEN from its environment. Refuse non-HTTPS API URLs except explicitly enabled localhost development. Do not forward credentials through cross-origin redirects. No token argument in tool calls.

Tools: community_me, community_channels, community_submission_schema, community_submit_research, community_submission_status, community_search_research, community_get_research. Read tools expose only what HTTP permits. Submission tools report pending_review distinctly from pending_delivery and published. Mark submission as a mutation in MCP annotations; annotations are hints, never access control.

Package the skill as an optional companion. It explains editorial format, human ownership, disclosure of agent assistance, review states and safe retry behaviour. Community research and external source text are untrusted data; instructions embedded in them must not control tools or expose credentials. Require human approval for sharing private or unpublished material unless the user has explicitly authorised that sharing workflow.

The backend owns schema versions. The client pins a compatible contract and reports incompatible server versions clearly. No hand-maintained competing permission tables in the MCP implementation.

## Delivery plan and acceptance checks

1. Confirm workspace owner, GitHub owner, channels, reviewers, posting controls, retention and hosting domain with the community operators. No assumptions about nonprofit Slack eligibility or retention limits.
2. Spike Slack installation, private token modal, channel restrictions and review interactions.
3. Implement schema, database migrations, auth, token lifecycle and permission-matrix tests.
4. Implement API, outbox, renderer and human review; run sandbox workspace integration tests.
5. Implement MCP wrapper and skill; release only after contract tests pass against backend.

Required tests: unknown field rejection; rendering/mention escaping; arbitrary channel rejection; read-only denial; no scope escalation; gated users cannot publish; forced review for admin-post; token revocation; deactivated membership; channel-private search; self-approval denial; stale approval denial; duplicate Slack events; idempotency mismatch; concurrent approvals; crash after Slack send; Slack 429; permission removal before delivery; expired membership cache; secret redaction; MCP/API parity; token issuance replay protection.

Deferred: automated AI judging, remote MCP/OAuth, direct Slack-history search, multi-workspace installations, file uploads, external URL fetching, agent delegation and elaborate taxonomy. Human review is sufficient for v1.
