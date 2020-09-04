import { Wallet, Contract } from 'ethers'
import { Web3Provider } from 'ethers/providers'
import { deployContract } from 'ethereum-waffle'

import { expandTo18Decimals } from './utilities'

import UniswapV2Factory from '@harmony-swoop/core/build/contracts/UniswapV2Factory.json'
import IUniswapV2Pair from '@harmony-swoop/core/build/contracts/IUniswapV2Pair.json'

import HRC20 from '../../build/contracts/HRC20.json'
import WONE from '../../build/contracts/WONE.json'
import UniswapV1Exchange from '../../build/UniswapV1Exchange.json'
import UniswapV1Factory from '../../build/UniswapV1Factory.json'
import UniswapV2Router01 from '../../build/contracts/UniswapV2Router01.json'
import UniswapV2Migrator from '../../build/contracts/UniswapV2Migrator.json'
import UniswapV2Router02 from '../../build/contracts/UniswapV2Router02.json'
import RouterEventEmitter from '../../build/contracts/RouterEventEmitter.json'

const overrides = {
  gasLimit: 9999999
}

interface V2Fixture {
  token0: Contract
  token1: Contract
  WONE: Contract
  WONEPartner: Contract
  factoryV1: Contract
  factoryV2: Contract
  router01: Contract
  router02: Contract
  routerEventEmitter: Contract
  router: Contract
  migrator: Contract
  WONEExchangeV1: Contract
  pair: Contract
  WONEPair: Contract
}

export async function v2Fixture(provider: Web3Provider, [wallet]: Wallet[]): Promise<V2Fixture> {
  // deploy tokens
  const tokenA = await deployContract(wallet, HRC20, [expandTo18Decimals(10000)])
  const tokenB = await deployContract(wallet, HRC20, [expandTo18Decimals(10000)])
  const wone = await deployContract(wallet, WONE)
  const WONEPartner = await deployContract(wallet, HRC20, [expandTo18Decimals(10000)])

  // deploy V1
  const factoryV1 = await deployContract(wallet, UniswapV1Factory, [])
  await factoryV1.initializeFactory((await deployContract(wallet, UniswapV1Exchange, [])).address)

  // deploy V2
  const factoryV2 = await deployContract(wallet, UniswapV2Factory, [wallet.address])

  // deploy routers
  const router01 = await deployContract(wallet, UniswapV2Router01, [factoryV2.address, wone.address], overrides)
  const router02 = await deployContract(wallet, UniswapV2Router02, [factoryV2.address, wone.address], overrides)

  // event emitter for testing
  const routerEventEmitter = await deployContract(wallet, RouterEventEmitter, [])

  // deploy migrator
  const migrator = await deployContract(wallet, UniswapV2Migrator, [factoryV1.address, router01.address], overrides)

  // initialize V1
  await factoryV1.createExchange(WONEPartner.address, overrides)
  const WONEExchangeV1Address = await factoryV1.getExchange(WONEPartner.address)
  const WONEExchangeV1 = new Contract(WONEExchangeV1Address, JSON.stringify(UniswapV1Exchange.abi), provider).connect(
    wallet
  )

  // initialize V2
  await factoryV2.createPair(tokenA.address, tokenB.address)
  const pairAddress = await factoryV2.getPair(tokenA.address, tokenB.address)
  const pair = new Contract(pairAddress, JSON.stringify(IUniswapV2Pair.abi), provider).connect(wallet)

  const token0Address = await pair.token0()
  const token0 = tokenA.address === token0Address ? tokenA : tokenB
  const token1 = tokenA.address === token0Address ? tokenB : tokenA

  await factoryV2.createPair(wone.address, WONEPartner.address)
  const WONEPairAddress = await factoryV2.getPair(wone.address, WONEPartner.address)
  const WONEPair = new Contract(WONEPairAddress, JSON.stringify(IUniswapV2Pair.abi), provider).connect(wallet)

  return {
    token0,
    token1,
    WONE: wone,
    WONEPartner,
    factoryV1,
    factoryV2,
    router01,
    router02,
    router: router02, // the default router, 01 had a minor bug
    routerEventEmitter,
    migrator,
    WONEExchangeV1,
    pair,
    WONEPair
  }
}
