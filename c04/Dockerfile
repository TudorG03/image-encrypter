FROM critoma/amd64_u24_noble_ism_security

# All required packages (openmpi, openssl, gcc, openssh-server) are pre-installed on the base image

# Passwordless SSH access for MPI (C03 → C04)
RUN mkdir -p /root/.ssh && chmod 700 /root/.ssh
COPY mpi-keys/id_rsa.pub /root/.ssh/authorized_keys
RUN chmod 600 /root/.ssh/authorized_keys

# Generate sshd host keys and create pidfile directory
RUN ssh-keygen -A && mkdir -p /run/sshd

# Allow root login with key only; disable strict mode for Docker volume permissions
RUN printf '\nPermitRootLogin yes\nPasswordAuthentication no\nPubkeyAuthentication yes\nStrictModes no\n' \
        >> /etc/ssh/sshd_config

EXPOSE 22

CMD ["/usr/sbin/sshd", "-D"]
