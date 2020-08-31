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
const Network = require("../network.js");
const { getAddress } = require("@harmony-js/crypto");

// Vars
const network = new Network(argv.network);
network.hmy.wallet.addByPrivateKey(network.privateKeys.deployer);

async function deploy() {
  let woneAddress = await deployContract('WONE');
  let multicallAddress = await deployContract('Multicall');

  console.log(`   WONE address: ${woneAddress} - ${getAddress(woneAddress).bech32}`);
  console.log(`   Multicall address: ${multicallAddress} - ${getAddress(multicallAddress).bech32}`);
  console.log(`   export NETWORK=${argv.network}; export WONE=${woneAddress}; export MULTICALL=${multicallAddress};`);
  console.log(`   addresses: {"wone": "${woneAddress}", "uniswapV2Pair": "${multicallAddress}"}\n`);
}

async function deployContract(contractName) {
  let contractJson = require(`../../build/contracts/${contractName}.json`);
  let contract = network.hmy.contracts.createContract(contractJson.abi);
  contract.wallet.addByPrivateKey(network.privateKeys.deployer);
  //contract.wallet.setSigner(network.privateKeys.deployer);
  let deployOptions = { data: contractJson.bytecode };

  let response = await contract.methods.contractConstructor(deployOptions).send(network.gasOptions());
  const contractAddress = response.transaction.receipt.contractAddress;
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
