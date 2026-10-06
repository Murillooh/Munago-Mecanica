#!/bin/bash
# t4g.micro tem 1 GB de RAM: sem swap o `npm install` do deploy é morto por falta de memória (exit 137).
set -euo pipefail
SWAPFILE=/var/swapfile
if ! swapon --show=NAME --noheadings | grep -qx "$SWAPFILE"; then
  if [ ! -f "$SWAPFILE" ]; then
    dd if=/dev/zero of="$SWAPFILE" bs=1M count=2048 status=none
    chmod 600 "$SWAPFILE"
    mkswap "$SWAPFILE" >/dev/null
  fi
  swapon "$SWAPFILE"
fi
