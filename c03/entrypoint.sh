#!/bin/bash
set -e

snmpd -c /etc/snmp/snmpd.conf
/usr/sbin/sshd

cp /build/encrypt_decrypt /mpi/encrypt_decrypt

exec /opt/software/apache-tomee-plume-10.0.0-M3/bin/catalina.sh run
