FROM critoma/amd64_u24_noble_ism_security

ENV PATH="/opt/software/nodejs/node-v22.21.0-linux-x64/bin:$PATH"

WORKDIR /app

RUN apt-get update && \
    apt-get install -y supervisor

COPY supervisord.conf /etc/supervisor/conf.d/c05.conf
COPY init.sql /init.sql
COPY package.json ./
RUN npm install
COPY app.js ./

EXPOSE 3001 3306 27017

CMD ["supervisord", "-n", "-c", "/etc/supervisor/supervisord.conf"]
