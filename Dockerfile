FROM ghcr.io/puppeteer/puppeteer:22.15.0

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

WORKDIR /home/pptruser/app
COPY --chown=pptruser:pptruser package*.json ./
RUN npm install --omit=dev
COPY --chown=pptruser:pptruser . .

EXPOSE 3333
CMD ["node", "server.js"]
