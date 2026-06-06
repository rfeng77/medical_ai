# server

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run dev
```

## Environment setup

Copy the example file:

```bash
cp .env.example .env
```

Then edit `.env` locally and add your own API key.

The real `.env` file is ignored by git and should not be committed.

## API examples

Reveal a participant-facing body-map clue without sending it to AI memory:

```bash
curl -X POST http://localhost:3001/api/reveal \
  -H "Content-Type: application/json" \
  -d '{
    "participantId": "test001",
    "caseId": "case_appendicitis_pattern",
    "condition": "chat",
    "regionKey": "right_lower_quadrant"
  }'
```

Send only participant-disclosed chat text through the AI-visible pipeline:

```bash
curl -X POST http://localhost:3001/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "participantId": "test001",
    "caseId": "case_appendicitis_pattern",
    "condition": "chat",
    "message": "I found pain in the lower right belly and walking makes it worse."
  }'
```

Record a participant decision without revealing ground truth:

```bash
curl -X POST http://localhost:3001/api/decision \
  -H "Content-Type: application/json" \
  -d '{
    "participantId": "test001",
    "caseId": "case_appendicitis_pattern",
    "condition": "chat",
    "selectedDecision": "A&E",
    "reasoning": "I chose this because the pain is on the lower right and movement makes it worse."
  }'
```

This project was created using `bun init` in bun v1.3.14. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.
