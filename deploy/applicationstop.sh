#!/bin/bash
if [ ! -d "/opt/deployment" ] 
then
    sudo mkdir /opt/deployment
fi
sudo pm2 kill
d=`date`
echo "$d : stopped" >> /opt/deployment/deploy.log
d=`date`
echo "$d : exiting stage 1 complete" >> /opt/deployment/deploy.log

exit 0