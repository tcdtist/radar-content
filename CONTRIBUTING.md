# Contributing to Radar Content

Thank you for your interest in contributing to Radar Content! Radar Content is an open-source, zero-cost content intelligence dashboard powered by Cloudflare Workers and Google Gemini Flash.

## Code of Conduct

Please be respectful, collaborative, and constructive in all discussions, pull requests, and code reviews.

## Getting Started

1. **Fork and Clone**:
   ```bash
   git clone https://github.com/tcdtist/radar-content.git
   cd radar-content
   ```
2. **Install Dependencies**:
   ```bash
   npm install
   ```
3. **Configure Local Environment**:
   ```bash
   cp .dev.vars.example .dev.vars
   # Fill in GEMINI_API_KEY with your key from https://aistudio.google.com/apikey
   ```
4. **Initialize Local D1 Database**:
   ```bash
   wrangler d1 execute radar-content-db --local --file=src/lib/db/schema.sql
   ```
5. **Run Local Dev Server**:
   ```bash
   npm run dev
   ```

## Development Standards

- **Strict TypeScript**: No `any` types. All data models must be strictly typed.
- **File Length Limit**: Files must stay under 200 lines of code. Modularize into sub-modules early.
- **Naming Conventions**:
  - `kebab-case` for file and directory names.
  - `PascalCase` for React components and TypeScript types/interfaces.
  - `camelCase` for functions, variables, and methods.
- **Testing**:
  - Run all Vitest suites: `npm test`
  - Run TypeScript checks: `npm run typecheck`
  - Build SPA: `npm run build`
- **Conventional Commits**:
  - `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`

## Pull Request Guidelines

1. Create a feature branch from `main`: `git checkout -b feat/your-feature`.
2. Ensure `npm test`, `npm run typecheck`, and `npm run build` pass with 0 errors.
3. Keep commits atomic and descriptive.
4. Open a Pull Request with a clear title and summary of changes.
