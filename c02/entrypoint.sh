#!/bin/sh
snmpd -c /etc/snmp/snmpd.conf
exec rabbitmq-server
