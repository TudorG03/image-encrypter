#!/bin/sh
snmpd -c /etc/snmp/snmpd.conf
exec /usr/sbin/sshd -D
