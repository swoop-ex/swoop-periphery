const WONE = artifacts.require("WONE");
const { getAddress } = require("@harmony-js/crypto");

module.exports = function (deployer, network, accounts) {
  deployer.deploy(WONE).then(function () {
    console.log(`   WONE address: ${WONE.address} - ${getAddress(WONE.address).bech32}`);
    console.log(`   export NETWORK=${network}; export WONE=${WONE.address};`);
    console.log(`   addresses: {"wone": "${WONE.address}"}`);
  }); // End WONE deployment
}
