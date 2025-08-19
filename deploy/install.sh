#!/bin/bash

cd /tmp/deploy/ >> /opt/deployment/deploy.log
sudo /bin/chmod 755 deploy/* >> /opt/deployment/deploy.log
d=`date`
echo "$d : changed permisssion of scripts" >> /opt/deployment/deploy.log
sudo /bin/cp -R /tmp/deploy/* /home/ec2-user/device-status-updater/ >> /opt/deployment/deploy.log
d=`date`
echo "$d : files copied " >> /opt/deployment/deploy.log
cd /home/ec2-user/device-status-updater >> /opt/deployment/deploy.log
sudo /bin/chmod 777 /home/ec2-user/device-status-updater/* >> /opt/deployment/deploy.log
d=`date`
echo "$d : pemission changed after copy in user/device-status-updater" >> /opt/deployment/deploy.log
d=`date`
echo "$d : downloaded bundle exiting stage 3 complete" >> /opt/deployment/deploy.log

cd /home/ec2-user/device-status-updater >> /opt/deployment/deploy.log
sudo cp /home/ec2-user/device-status-updater/deploy/env.sh /etc/environment; set -a; source /etc/environment; set +a;

d=`date`
echo "$d : navigating to user/device-status-updater" >> /opt/deployment/deploy.log
sudo npm install >> /opt/deployment/deploy.log

d=`date`
echo "$d : installtion in process" >> /opt/deployment/deploy.log
d=`date`
echo "$d :pemission changed after copy in user/deploy" >> /opt/deployment/deploy.log
d=`date`
echo "$d : exiting stage 4 complete" >> /opt/deployment/deploy.log

exit 0
