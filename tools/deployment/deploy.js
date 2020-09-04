// Args
const yargs = require('yargs');
const argv = yargs
    .option('network', {
        alias: 'n',
        description: 'Which network to use',
        type: 'string',
        default: 'testnet'
    })
    .help()
    .alias('help', 'h')
    .argv;

// Libs
const Network = require('../network.js');
const { getAddress } = require('@harmony-js/crypto');

// Vars
const network = new Network(argv.network);
network.hmy.wallet.addByPrivateKey(network.accounts.deployer.private_key)

const contracts = {
  // SafeMath: [],
  // RouterEventEmitter: [],
  // Multicall: [],
  // Migrations: [],

  // DeflatingHRC20: [10000000],

  // IUniswapV2Callee: [],
  // IUniswapV1Exchange: [],
  // IUniswapV1Factory: [],
  // IUniswapV2Factory: [],
  // IUniswapV2Pair: [],
  // IUniswapV2Router01: [],
  // IUniswapV2Router02: [],
  // IUniswapV2Migrator: [],

  UniswapV2Router01: [network.accounts.deployer.address, process.env.WONE_ADDRESS],
  UniswapV2Router02: [network.accounts.deployer.address, process.env.WONE_ADDRESS],
  UniswapV2Migrator: [process.env.V1_FACTORY, process.env.ROUTER_1],
  UniswapV2Library: [],
  UniswapV2OracleLibrary: []
}

async function deploy() {
  for (const contract in contracts) {
    const args = contracts[contract];
    const addr = await deployContract(contract, args);
    console.log(`    Deployed contract ${contract}: ${addr} (${getAddress(addr).bech32})`)
  }
}

async function deployContract(contractName, args) {
  let contractJson = require(`../../build/contracts/${contractName}`)
  // console.log(JSON.stringify(contractJson.abi))
  let contract = network.hmy.contracts.createContract(contractJson.abi)
  contract.wallet.addByPrivateKey(network.accounts.deployer.private_key)
  // contract.wallet.setSigner(network.network.accounts.deployer.private_key);
  let options = {
    data: '0x' + contractJson.bytecode,
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
