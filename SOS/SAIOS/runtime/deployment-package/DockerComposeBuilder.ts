/**
 * docker-compose builder — single service, no cloud bindings.
 */
export function buildDockerCompose(): string {
  return `# AI OS docker-compose — Agent #112
# Does not deploy. Template only.
services:
  aios:
    build:
      context: ../../../../
      dockerfile: SOS/07_LOGS/saios/deployment-package/Dockerfile
    container_name: aios-runtime
    restart: unless-stopped
    env_file:
      - .env
    environment:
      SOS_AIOS_LIVE: "0"
      SOS_SUPERVISOR_DRY_RUN: "true"
      NODE_ENV: production
    ports:
      - "3000:3000"
    volumes:
      - aios_logs:/app/SOS/07_LOGS
    healthcheck:
      test: ["CMD", "node", "SOS/07_LOGS/saios/deployment-package/healthcheck.js"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

volumes:
  aios_logs:
`;
}
