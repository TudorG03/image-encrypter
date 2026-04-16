#!/bin/bash
set -e

cp /build/encrypt_decrypt /mpi/encrypt_decrypt

exec /opt/software/apache-tomee-plume-10.0.0-M3/bin/catalina.sh run
