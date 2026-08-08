# OrbitMind

AI-native relationship intelligence and safe email sequencing.

## Product pillars

- **People graph:** derive every real relationship from sent and received mailbox activity.
- **Explainable strength:** score recency, frequency, reciprocity, response behavior, and continuity.
- **Company and category intelligence:** resolve identities with confidence and preserve corrections.
- **Sequences:** schedule multi-step emails with time zones, threading, reply stops, and audit history.

## Local development

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env` before connecting a database. The demo workspace uses isolated fixture data, while authenticated Google accounts use their synchronized Gmail data.

## Architecture

The first milestone is a Next.js/TypeScript application with pure domain modules and a Prisma/PostgreSQL schema. Mail providers are adapters; normalized message events are the source of truth. Relationship projections and sequence delivery state can therefore be tested independently of Gmail.
