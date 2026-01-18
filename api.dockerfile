FROM node:22-alpine

WORKDIR /app

COPY ./ . /

RUN yarn workspaces focus clean-demo-alpine

RUN yarn build:api

EXPOSE 3000

CMD ["node", "dist/apps/api/main.js", "start"]
