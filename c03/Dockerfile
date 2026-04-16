FROM critoma/amd64_u24_noble_ism_security

ENV JAVA_HOME=/opt/software/java/jdks/jdk-25.0.1
ENV CATALINA_HOME=/opt/software/apache-tomee-plume-10.0.0-M3
ENV PATH="$JAVA_HOME/bin:$CATALINA_HOME/bin:$PATH"

RUN mkdir -p /root/.ssh && chmod 700 /root/.ssh
COPY mpi-keys/id_rsa /root/.ssh/id_rsa
RUN chmod 600 /root/.ssh/id_rsa
RUN printf 'Host c04\n\tStrictHostKeyChecking no\n\tUserKnownHostsFile /dev/null\n' \
    > /root/.ssh/config && chmod 600 /root/.ssh/config

COPY c03/encrypt_decrypt.c /build/encrypt_decrypt.c
RUN mpicc -O2 -fopenmp -o /build/encrypt_decrypt /build/encrypt_decrypt.c -lssl -lcrypto

COPY c03/c03/target/c03.war $CATALINA_HOME/webapps/c03.war

COPY c03/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 8080
CMD ["/entrypoint.sh"]
