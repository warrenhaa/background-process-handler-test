#!/bin/bash
if [ ! -d "/opt/deployment" ] 
then
    sudo mkdir /opt/deployment
fi
sudo /bin/rm -rf /tmp/deploy/* >> /opt/deployment/deploy.log
d=`date`
echo "$d : Cleared the temp folder" >> /opt/deployment/deploy.log
if [ ! -d "/home/ec2-user/device-status-updater" ] 
then
    mkdir /home/ec2-user/device-status-updater
fi
sudo /bin/rm -rf /home/ec2-user/device-status-updater/* >> /opt/deployment/deploy.log

d=`date`
echo "$d : Cleared the deployment folder" >> /opt/deployment/deploy.log
d=`date`
echo "$d : before install exiting stage 2 complete" >> /opt/deployment/deploy.log

exit 0