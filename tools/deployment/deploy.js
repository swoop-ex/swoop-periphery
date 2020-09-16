const v2Factory = require('@harmony-swoop/core/build/contracts/UniswapV2Factory.json');

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
      type: 'string',
      default: process.env.UNISWAPV2FACTORY
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

// Libs
const Network = require('../network.js');
const { getAddress } = require('@harmony-js/crypto');

// Vars
const network = new Network(argv.network);
network.hmy.wallet.addByPrivateKey(network.privateKeys.deployer)

const deployed = {};

async function deploy() {
  await deployDependencies();
  
  const contracts = {
    UniswapV2Router02: [factoryAddress, woneAddress],
  }

  if (multiCallAddress == null || multiCallAddress == '') {
    contracts['Multicall'] = [];
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
  console.log(`\n    ${env}`);
}

async function deployDependencies() {
  if (factoryAddress == null || factoryAddress == '') {
    factoryAddress = await deployFactory()
  }
  deployed['UniswapV2Factory'] = factoryAddress;
  
  if (woneAddress == null || woneAddress == '') {
    woneAddress = await deployWONE();
  }
  deployed['WONE'] = woneAddress;
}

async function deployFactory() {
  const addr = await performContractDeployment(v2Factory.abi, [network.hmy.wallet.signer.address]);
  console.log(`    Deployed contract UniswapV2Factory: ${addr} (${getAddress(addr).bech32})`)
  
  return addr
}

async function deployWONE() {
  const contract = 'WONE';
  const addr = await deployContract(contract, []);
  console.log(`    Deployed contract ${contract}: ${addr} (${getAddress(addr).bech32})`)
  
  return addr
}

async function deployContract(contractName, args) {
  let contractJson = require(`../../build/contracts/${contractName}`)
  const contractAddress = await performContractDeployment(contractJson.abi, args)

  return contractAddress
}

async function performContractDeployment(abi, args) {
  let contract = network.hmy.contracts.createContract(abi)
  contract.wallet.addByPrivateKey(network.privateKeys.deployer)
  // contract.wallet.setSigner(network.privateKeys.deployer);
  
  let options = {
    arguments: args
  };

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
