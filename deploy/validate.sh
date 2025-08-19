#!/usr/bin/env bash

d=`date`
echo "$d : Validate Script" >> /opt/deployment/deploy.log

while true
do
  sudo pm2 list >> /tmp/validate.txt
  if grep -q "online" /tmp/validate.txt; then
    echo "Successfully pulled pm2 status." >> /opt/deployment/deploy.log
    exit 0;
  fi
  echo "Backing off and retrying." >> /opt/deployment/deploy.log
  sudo /bin/rm /tmp/validate.txt
  sleep 30
done

echo "Server did not come up after expected time. Failing." >> /opt/deployment/deploy.log
exit 1