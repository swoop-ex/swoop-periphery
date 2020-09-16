#!/usr/bin/env bash

usage() {
   cat << EOT
Usage: $0 [option] command
Options:
   --method     method      what method to use for deployment (truffle or hmy)
   --network    network     what network to deploy to (testnet or mainnet)
   --reset                  if truffle should be run with --reset
   --help                   print this help
EOT
}

while [ $# -gt 0 ]
do
  case $1 in
  --method) method="${2}" ; shift;;
  --network) network="${2}" ; shift;;
  # Truffle
  --reset) reset=true;;
  --skip-dry-run) skip_dry_run=true;;
  # Custom deployment
  --factory) factory="${2}" ; shift;;
  --wone) wone="${2}" ; shift;;
  --multicall) multicall="${2}" ; shift;;
  -h|--help) usage; exit 1;;
  (--) shift; break;;
  (-*) usage; exit 1;;
  (*) break;;
  esac
  shift
done

set_defaults() {  
  if [ -z "$method" ]; then
    method="hmy"
  fi
  
  if [ -z "$network" ]; then
    network="testnet"
  fi
  
  if [ -z "$reset" ]; then
    reset=false
  fi

  if [ -z "$skip_dry_run" ]; then
    skip_dry_run=false
  fi
}

truffle_deployment() {
  reset_command=""
  if [ "$reset" = true ]; then
    reset_command="--reset"
  fi

  skip_dry_run_command=""
  if [ "$skip_dry_run" = true ]; then
    skip_dry_run_command="--skip-dry-run"
  fi

  echo "Deploying using truffle - command: truffle migrate --network $network $reset_command $skip_dry_run_command"
  truffle migrate --network $network $reset_command $skip_dry_run_command
}

hmy_deployment() {
  factory_argument=""
  if [ ! -z "$factory" ]; then
    factory_argument="--factory ${factory}"
  fi

  wone_argument=""
  if [ ! -z "$wone" ]; then
    wone_argument="--wone ${wone}"
  fi

  multicall_argument=""
  if [ ! -z "$multicall" ]; then
    multicall_argument="--multicall ${multicall}"
  fi

  echo "Deploying using hmy - arguments: --network $network $factory_argument $wone_argument $multicall_argument"

  node tools/deployment/deploy.js --network $network $factory_argument $wone_argument $multicall_argument
}

deploy() {
  set_defaults

  if [ "$method" = "hmy" ]; then
    hmy_deployment
  else
    truffle_deployment
  fi
}

deploy
