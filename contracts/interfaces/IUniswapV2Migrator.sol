pragma solidity >=0.5.0;

interface IUniswapV2Migrator {
    function migrate(address token, uint amountTokenMin, uint amountONEMin, address to, uint deadline) external;
}
