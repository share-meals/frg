FROM directus/directus:11.3.5

USER root
RUN corepack enable
USER node

RUN pnpm install directus-extension-schema-sync
COPY ./data/d7_directus/schema-sync ./schema-sync
