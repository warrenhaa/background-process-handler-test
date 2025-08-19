#!/bin/bash

cd /home/ec2-user/device-status-updater
sudo pm2 start npm -- start >> /opt/deployment/deploy.log
d=`date`
echo "$d : starting" >> /opt/deployment/deploy.log
d=`date`
echo "$d : exiting stage 5 complete" >> /opt/deployment/deploy.log

exit 0
