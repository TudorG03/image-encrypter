FROM critoma/amd64_u24_noble_ism_security

ENV JAVA_HOME=/opt/software/java/jdks/jdk-25.0.1
ENV PATH="$JAVA_HOME/bin:$PATH"

RUN apt-get update && \
    apt-get install -y maven curl snmpd && \
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get install -y nodejs && \
    rm -rf /var/lib/apt/lists/*

COPY snmpd.conf /etc/snmp/snmpd.conf

# Build Next.js frontend
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build && \
    cp -r .next/static .next/standalone/.next/static

# Build Spring Boot backend
WORKDIR /app/backend
COPY backend/pom.xml ./
COPY backend/src ./src
RUN mvn package -DskipTests

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 3000 8080

ENTRYPOINT ["/entrypoint.sh"]
