/**
 * Dockerfile builder — Ubuntu/Node 22 assumptions, no cloud-specific logic.
 */
export function buildDockerfile(): string {
  return `# AI OS Deployment Package — Agent #112
# Assumptions: Ubuntu 24.04 host · Node 22 LTS · no Kubernetes
FROM node:22-bookworm-slim

WORKDIR /app

# System deps for native modules / health scripts
RUN apt-get update \\
  && apt-get install -y --no-install-recommends git ca-certificates curl \\
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev || npm install --omit=dev

COPY . .

ENV NODE_ENV=production
ENV SOS_AIOS_LIVE=0
ENV SOS_SUPERVISOR_DRY_RUN=true
ENV SOS_RUNTIME_LOOP_DRY_RUN=true

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \\
  CMD node SOS/07_LOGS/saios/deployment-package/healthcheck.js || exit 1

# Default: safe verify continuity (not LIVE)
CMD ["npm", "run", "live-runtime:verify"]
`;
}
