<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## 수정 전 최신 소스

사용자가 소스 수정 프롬프트를 주면, 수정 전에 원격의 최신 소스를 먼저 받는다. 현재 브랜치와 `main`을 `git fetch`하고, 로컬이 뒤처져 있으면 pull 또는 rebase로 맞춘 뒤, 그 최신 소스를 기준으로 수정한다. 최신 소스를 받기 전에는 파일을 고치지 않는다.
