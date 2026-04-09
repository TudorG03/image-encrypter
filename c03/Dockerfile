FROM critoma/amd64_u24_noble_ism_security

# NOTE: TomEE Plume 10.0.0-M3 is pre-installed on the critoma base image — do not reinstall

# TODO: Install OpenMPI, OpenSSL dev headers, gcc, libgomp (OpenMP)
# TODO: Install SSH client
# TODO: Copy MPI private key (mpi-keys/id_rsa) to /root/.ssh/id_rsa (chmod 600)
# TODO: Add SSH config to skip StrictHostKeyChecking for c04
# TODO: Build encrypt_decrypt.c into /mpi/encrypt_decrypt (shared volume populated at runtime)
# TODO: Deploy TomEE app (WAR) containing the RabbitMQ POJO consumer EJB
# TODO: Entrypoint: copy compiled binary into /mpi/, then start TomEE

EXPOSE 8080
