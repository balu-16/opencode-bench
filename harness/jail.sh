#!/bin/sh
# jail.sh <real_workdir> <jail_workdir> <cmd...>
# Runs <cmd> as the sandbox user in a private mount namespace where /workspace and /tmp are empty tmpfs,
# except: the opencode home (binary + config + session DB) and the model's own work dir (mounted at <jail_workdir>).
# So the model cannot see the spec, other models' outputs, logs, or the user's files.
# Invoke: sudo unshare -m --propagation private sh jail.sh ...
set -e
REAL="$1"; JAIL="$2"; shift 2
OCH=/workspace/projects/b8b4b3d3-4531-4ae4-bf38-8c9e70645b29/work/ochome
mkdir -p /stage_och /stage_wd
mount --bind "$OCH" /stage_och
mount --bind "$REAL" /stage_wd
mount -t tmpfs none /workspace
mount -t tmpfs -o mode=1777 none /tmp
mkdir -p "$OCH" "$JAIL"
mount --move /stage_och "$OCH"
mount --move /stage_wd "$JAIL"
# config + cache live on the jail's tmpfs (copy of opencode config) so model-launched tools (e.g. Chromium profiles)
# never write into the persistent workspace; the session DB stays in $OCH/data.
mkdir -p /tmp/xdg/config /tmp/xdg/cache
cp -r "$OCH/config/opencode" /tmp/xdg/config/opencode
chown -R 1000:1000 "$JAIL" /tmp
cd "$JAIL"
exec setpriv --reuid=1000 --regid=1000 --init-groups env HOME=/home/sandbox PWD="$JAIL" \
  XDG_CONFIG_HOME=/tmp/xdg/config XDG_CACHE_HOME=/tmp/xdg/cache "$@"
