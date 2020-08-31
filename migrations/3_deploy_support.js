const Multicall = artifacts.require("Multicall");
const { getAddress } = require("@harmony-js/crypto");

module.exports = function (deployer, network, accounts) {
  deployer.deploy(Multicall).then(function () {
    console.log(`   Multicall address: ${Multicall.address} - ${getAddress(Multicall.address).bech32}`);
    console.log(`   export NETWORK=${network}; export MULTICALL=${Multicall.address};`);
    console.log(`   addresses: {"multicall": "${Multicall.address}"}`);
  }); // End Multicall deployment
}
