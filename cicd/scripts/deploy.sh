#!/bin/bash

#######################
# VARIABLES           #
#######################
ROOT_DIR=$(dirname $(dirname $(dirname $(realpath $0))))

### NO EDITS BELOW THIS LINE ###
cd ${ROOT_DIR}
source .env

mkdir -p ${HOME}/.ssh
chmod 700 ${HOME}/.ssh
echo "${SSH_KEY}" > ${HOME}/.ssh/id_ed25519-${SSH_HOST//./_}
echo "${SSH_KNOWN_HOST}" > ${HOME}/.ssh/known_hosts-${SSH_HOST//./_}
chmod -R 600 ${HOME}/.ssh/
chmod 700 ${HOME}/.ssh

grep -q "Host ${SSH_HOST}" ${HOME}/.ssh/config || cat >> ${HOME}/.ssh/config <<EOF
Host ${SSH_HOST}
    HostName ${SSH_HOST}
    User ${SSH_USER}
    Port ${SSH_PORT}
    IdentityFile ${HOME}/.ssh/id_ed25519-${SSH_HOST//./_}
    UserKnownHostsFile ${HOME}/.ssh/known_hosts-${SSH_HOST//./_}
    StrictHostKeyChecking yes
    ControlMaster     auto
    ControlPath       ~/.ssh/control-%C
    ControlPersist    yes
    ConnectionAttempts 3
    ConnectTimeout 10
    ServerAliveInterval 10
EOF

DOCKER_HOST=ssh://${SSH_HOST} docker load -i ${IMAGE_FILENAME}

ssh ${SSH_HOST} "mkdir -p /srv/${IMAGE_NAME#*/}/"
ssh ${SSH_HOST} "cd /srv/${IMAGE_NAME#*/}/ && docker compose down"
scp .env ${SSH_HOST}:/srv/${IMAGE_NAME#*/}/.env
cd deploy
scp -r . ${SSH_HOST}:/srv/${IMAGE_NAME#*/}/
ssh ${SSH_HOST} "cd /srv/${IMAGE_NAME#*/}/ && docker compose up -d"
