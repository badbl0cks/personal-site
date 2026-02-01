#!/bin/bash
cat /etc/letsencrypt/live/badblocks.dev/fullchain.pem /etc/letsencrypt/live/badblocks.dev/privkey.pem > /etc/letsencrypt/fullcert.pem
chmod 755 /etc/letsencrypt/
chmod 644 /etc/letsencrypt/fullcert.pem
