#!/bin/sh
snmpd -c /etc/snmp/snmpd.conf
cd /app/frontend/.next/standalone && HOSTNAME=0.0.0.0 node server.js &
exec java -jar /app/backend/target/c01.jar
