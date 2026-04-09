FROM critoma/amd64_u24_noble_ism_security

RUN apt-get update -y && \
    apt-get install -y curl gnupg apt-transport-https && \
    curl -1sLf "https://keys.openpgp.org/vks/v1/by-fingerprint/0A9AF2115F4687BD29803A206B73A36E6026DFCA" | \
    gpg --dearmor | tee /usr/share/keyrings/com.rabbitmq.team.gpg > /dev/null && \
    tee /etc/apt/sources.list.d/rabbitmq.list <<EOF
deb [arch=amd64 signed-by=/usr/share/keyrings/com.rabbitmq.team.gpg] https://deb1.rabbitmq.com/rabbitmq-erlang/ubuntu/noble noble main
deb [arch=amd64 signed-by=/usr/share/keyrings/com.rabbitmq.team.gpg] https://deb2.rabbitmq.com/rabbitmq-server/ubuntu/noble noble main
EOF

RUN apt-get update -y && \
    apt-get install -y erlang-base \
    erlang-asn1 erlang-crypto erlang-eldap erlang-ftp erlang-inets \
    erlang-mnesia erlang-os-mon erlang-parsetools erlang-public-key \
    erlang-runtime-tools erlang-snmp erlang-ssl \
    erlang-syntax-tools erlang-tftp erlang-tools erlang-xmerl && \
    apt-get install -y rabbitmq-server && \
    rm -rf /var/lib/apt/lists/*

RUN rabbitmq-plugins enable rabbitmq_management

COPY rabbitmq.conf /etc/rabbitmq/rabbitmq.conf
COPY definitions.json /etc/rabbitmq/definitions.json

EXPOSE 5672 15672

CMD ["rabbitmq-server"]
