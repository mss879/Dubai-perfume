<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Database Migrations Rule
- ALWAYS create a new migration file (with an incremented sequence number, e.g. `35_...`) whenever database schema or data updates are needed.
- NEVER edit existing migration files once created.

