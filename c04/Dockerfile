FROM critoma/amd64_u24_noble_ism_security

RUN mkdir -p /root/.ssh && chmod 700 /root/.ssh
COPY mpi-keys/id_rsa.pub /root/.ssh/authorized_keys
RUN chmod 600 /root/.ssh/authorized_keys

RUN ssh-keygen -A && mkdir -p /run/sshd

RUN printf '\nPermitRootLogin yes\nPasswordAuthentication no\nPubkeyAuthentication yes\nStrictModes no\n' \
    >> /etc/ssh/sshd_config

RUN apt-get update && apt-get install -y snmpd && rm -rf /var/lib/apt/lists/*
COPY c04/snmpd.conf /etc/snmp/snmpd.conf
COPY c04/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 22

CMD ["/entrypoint.sh"]
