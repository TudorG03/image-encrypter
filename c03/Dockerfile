# Stage 1: Build the WAR with JDK 17
FROM maven:3.9-eclipse-temurin-17 AS builder
WORKDIR /build
COPY c03/c03/pom.xml .
COPY c03/c03/src ./src
RUN mvn clean package -DskipTests

# Stage 2: Runtime
FROM critoma/amd64_u24_noble_ism_security

ENV JAVA_HOME=/opt/software/java/jdks/jdk-25.0.1
ENV CATALINA_HOME=/opt/software/apache-tomee-plume-10.0.0-M3
ENV PATH="$JAVA_HOME/bin:$CATALINA_HOME/bin:$PATH"

RUN mkdir -p /root/.ssh && chmod 700 /root/.ssh
COPY mpi-keys/id_rsa /root/.ssh/id_rsa
COPY mpi-keys/id_rsa.pub /root/.ssh/authorized_keys
RUN chmod 600 /root/.ssh/id_rsa /root/.ssh/authorized_keys
RUN printf 'Host *\n\tStrictHostKeyChecking no\n\tUserKnownHostsFile /dev/null\n' \
    > /root/.ssh/config && chmod 600 /root/.ssh/config

RUN ssh-keygen -A && mkdir -p /run/sshd
RUN printf '\nPermitRootLogin yes\nPasswordAuthentication no\nPubkeyAuthentication yes\nStrictModes no\n' \
    >> /etc/ssh/sshd_config

COPY c03/encrypt_decrypt.c /build/encrypt_decrypt.c
RUN mpicc -O2 -fopenmp -o /build/encrypt_decrypt /build/encrypt_decrypt.c -lssl -lcrypto

COPY --from=builder /build/target/c03.war $CATALINA_HOME/webapps/c03.war

COPY c03/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 8080
CMD ["/entrypoint.sh"]
