const woneArtifact = require('@harmony-swoop/misc/build/contracts/WONE.json');
const multicallArtifact = require('@harmony-swoop/misc/build/contracts/Multicall.json');

require('dotenv').config()

// Args
const yargs = require('yargs');
const argv = yargs
    .option('network', {
        alias: 'n',
        description: 'Which network to use',
        type: 'string',
        default: 'testnet'
    })
    .option('factory', {
      alias: 'f',
      description: 'The address of the UniswapV2Factory',
      type: 'string'
    })
    .option('wone', {
      alias: 'w',
      description: 'The address of the WONE token contract',
      type: 'string',
      default: process.env.WONE
    })
    .option('multicall', {
      alias: 'm',
      description: 'The address of the Multicall contract',
      type: 'string',
      default: process.env.MULTICALL
    })
    .help()
    .alias('help', 'h')
    .argv;

var factoryAddress = argv.factory;
var woneAddress = argv.wone;
var multiCallAddress = argv.multicall;

if (factoryAddress == null || factoryAddress == '') {
  console.log('You must supply a factory address using --factory CONTRACT_ADDRESS or -f CONTRACT_ADDRESS!');
  process.exit(0);
}

// Libs
const { NetworkEnv } = require("@harmony-swoop/utils");
const { getAddress } = require('@harmony-js/crypto');

// Vars
const network = new NetworkEnv(argv.network);
network.client.wallet.addByPrivateKey(network.accounts.deployer.privateKey);

const deployed = {};

async function deploy() {
  await deployDependencies();
  
  const contracts = {
    UniswapV2Router02: [factoryAddress, woneAddress],
  }

  for (const contract in contracts) {
    const args = contracts[contract];
    const addr = await deployContract(contract, args);
    deployed[contract] = addr;
    console.log(`    Deployed contract ${contract}: ${addr} (${getAddress(addr).bech32})`)
  }

  var env = '';
  for (const contract in deployed) {
    const addr = deployed[contract];
    env += `export ${contract.toUpperCase()}=${addr}; `
  }
  console.log(`\n    export NETWORK=${argv.network}; ${env}`);
}

async function deployDependencies() {
  if (multiCallAddress == null || multiCallAddress == '') {
    multiCallAddress = await deployMulticall()
  }
  deployed['Multicall'] = multiCallAddress;
  
  if (woneAddress == null || woneAddress == '') {
    woneAddress = await deployWONE();
  }
  deployed['WONE'] = woneAddress;
}

async function deployMulticall() {
  const addr = await performContractDeployment(multicallArtifact, null);
  console.log(`    Deployed contract Multicall: ${addr} (${getAddress(addr).bech32})`)
  
  return addr
}

async function deployWONE() {
  const addr = await performContractDeployment(woneArtifact, null);
  console.log(`    Deployed contract WONE: ${addr} (${getAddress(addr).bech32})`)
  
  return addr
}

async function deployContract(contractName, args) {
  let contractJson = require(`../../build/contracts/${contractName}`)
  const contractAddress = await performContractDeployment(contractJson, args)

  return contractAddress
}

async function performContractDeployment(contractJson, args) {
  let contract = network.client.contracts.createContract(contractJson.abi)
  contract.wallet.addByPrivateKey(network.accounts.deployer.privateKey)
  // contract.wallet.setSigner(network.privateKeys.deployer);
  
  let options = {
    data: '0x' + contractJson.bytecode
  };

  if (args != null) {
    options['arguments'] = args
  }

  let response = await contract.methods.contractConstructor(options).send(network.gasOptions())
  const contractAddress = response.transaction.receipt.contractAddress
  return contractAddress
}

deploy()
  .then(() => {
    process.exit(0);
  })
  .catch(function(err){
    console.log(err);
    process.exit(0);
  });
