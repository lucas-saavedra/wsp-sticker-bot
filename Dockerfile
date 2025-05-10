FROM node:18

RUN apt-get update && \
    apt-get install -y ffmpeg && \
    apt-get clean

WORKDIR /app
COPY . .
RUN npm install

CMD ["npm", "start"]