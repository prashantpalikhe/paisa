#!/bin/bash
# Helper script for .claude/launch.json preview servers.
# Loads nvm so that node/pnpm are available, then runs the given command.
source ~/.nvm/nvm.sh
exec "$@"
