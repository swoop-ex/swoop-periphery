import chai, { expect } from 'chai'
import { Contract } from 'ethers'
import { MaxUint256 } from 'ethers/constants'
import { BigNumber, bigNumberify, defaultAbiCoder, formatEther } from 'ethers/utils'
import { solidity, MockProvider, createFixtureLoader, deployContract } from 'ethereum-waffle'

import { expandTo18Decimals } from './shared/utilities'
import { v2Fixture } from './shared/fixtures'

import ExampleFlashSwap from '../build/contracts/ExampleFlashSwap.json'

chai.use(solidity)

const overrides = {
  gasLimit: 9999999,
  gasPrice: 0
}

describe('ExampleFlashSwap', () => {
  const provider = new MockProvider({
    hardfork: 'istanbul',
    mnemonic: 'horn horn horn horn horn horn horn horn horn horn horn horn',
    gasLimit: 9999999
  })
  const [wallet] = provider.getWallets()
  const loadFixture = createFixtureLoader(provider, [wallet])

  let wone: Contract
  let WONEPartner: Contract
  let WONEExchangeV1: Contract
  let WONEPair: Contract
  let flashSwapExample: Contract
  beforeEach(async function() {
    const fixture = await loadFixture(v2Fixture)

    wone = fixture.WONE
    WONEPartner = fixture.WONEPartner
    WONEExchangeV1 = fixture.WONEExchangeV1
    WONEPair = fixture.WONEPair
    flashSwapExample = await deployContract(
      wallet,
      ExampleFlashSwap,
      [fixture.factoryV2.address, fixture.factoryV1.address, fixture.router.address],
      overrides
    )
  })

  it('uniswapV2Call:0', async () => {
    // add liquidity to V1 at a rate of 1 ONE / 200 X
    const WONEPartnerAmountV1 = expandTo18Decimals(2000)
    const ONEAmountV1 = expandTo18Decimals(10)
    await WONEPartner.approve(WONEExchangeV1.address, WONEPartnerAmountV1)
    await WONEExchangeV1.addLiquidity(bigNumberify(1), WONEPartnerAmountV1, MaxUint256, {
      ...overrides,
      value: ONEAmountV1
    })

    // add liquidity to V2 at a rate of 1 ONE / 100 X
    const WONEPartnerAmountV2 = expandTo18Decimals(1000)
    const ONEAmountV2 = expandTo18Decimals(10)
    await WONEPartner.transfer(WONEPair.address, WONEPartnerAmountV2)
    await wone.deposit({ value: ONEAmountV2 })
    await wone.transfer(WONEPair.address, ONEAmountV2)
    await WONEPair.mint(wallet.address, overrides)

    const balanceBefore = await WONEPartner.balanceOf(wallet.address)

    // now, execute arbitrage via uniswapV2Call:
    // receive 1 ONE from V2, get as much X from V1 as we can, repay V2 with minimum X, keep the rest!
    const arbitrageAmount = expandTo18Decimals(1)
    // instead of being 'hard-coded', the above value could be calculated optimally off-chain. this would be
    // better, but it'd be better yet to calculate the amount at runtime, on-chain. unfortunately, this requires a
    // swap-to-price calculation, which is a little tricky, and out of scope for the moment
    const WONEPairToken0 = await WONEPair.token0()
    const amount0 = WONEPairToken0 === WONEPartner.address ? bigNumberify(0) : arbitrageAmount
    const amount1 = WONEPairToken0 === WONEPartner.address ? arbitrageAmount : bigNumberify(0)
    await WONEPair.swap(
      amount0,
      amount1,
      flashSwapExample.address,
      defaultAbiCoder.encode(['uint'], [bigNumberify(1)]),
      overrides
    )

    const balanceAfter = await WONEPartner.balanceOf(wallet.address)
    const profit = balanceAfter.sub(balanceBefore).div(expandTo18Decimals(1))
    const reservesV1 = [
      await WONEPartner.balanceOf(WONEExchangeV1.address),
      await provider.getBalance(WONEExchangeV1.address)
    ]
    const priceV1 = reservesV1[0].div(reservesV1[1])
    const reservesV2 = (await WONEPair.getReserves()).slice(0, 2)
    const priceV2 =
      WONEPairToken0 === WONEPartner.address ? reservesV2[0].div(reservesV2[1]) : reservesV2[1].div(reservesV2[0])

    expect(profit.toString()).to.eq('69') // our profit is ~69 tokens
    expect(priceV1.toString()).to.eq('165') // we pushed the v1 price down to ~165
    expect(priceV2.toString()).to.eq('123') // we pushed the v2 price up to ~123
  })

  it('uniswapV2Call:1', async () => {
    // add liquidity to V1 at a rate of 1 ONE / 100 X
    const WONEPartnerAmountV1 = expandTo18Decimals(1000)
    const ONEAmountV1 = expandTo18Decimals(10)
    await WONEPartner.approve(WONEExchangeV1.address, WONEPartnerAmountV1)
    await WONEExchangeV1.addLiquidity(bigNumberify(1), WONEPartnerAmountV1, MaxUint256, {
      ...overrides,
      value: ONEAmountV1
    })

    // add liquidity to V2 at a rate of 1 ONE / 200 X
    const WONEPartnerAmountV2 = expandTo18Decimals(2000)
    const ONEAmountV2 = expandTo18Decimals(10)
    await WONEPartner.transfer(WONEPair.address, WONEPartnerAmountV2)
    await wone.deposit({ value: ONEAmountV2 })
    await wone.transfer(WONEPair.address, ONEAmountV2)
    await WONEPair.mint(wallet.address, overrides)

    const balanceBefore = await provider.getBalance(wallet.address)

    // now, execute arbitrage via uniswapV2Call:
    // receive 200 X from V2, get as much ONE from V1 as we can, repay V2 with minimum ONE, keep the rest!
    const arbitrageAmount = expandTo18Decimals(200)
    // instead of being 'hard-coded', the above value could be calculated optimally off-chain. this would be
    // better, but it'd be better yet to calculate the amount at runtime, on-chain. unfortunately, this requires a
    // swap-to-price calculation, which is a little tricky, and out of scope for the moment
    const WONEPairToken0 = await WONEPair.token0()
    const amount0 = WONEPairToken0 === WONEPartner.address ? arbitrageAmount : bigNumberify(0)
    const amount1 = WONEPairToken0 === WONEPartner.address ? bigNumberify(0) : arbitrageAmount
    await WONEPair.swap(
      amount0,
      amount1,
      flashSwapExample.address,
      defaultAbiCoder.encode(['uint'], [bigNumberify(1)]),
      overrides
    )

    const balanceAfter = await provider.getBalance(wallet.address)
    const profit = balanceAfter.sub(balanceBefore)
    const reservesV1 = [
      await WONEPartner.balanceOf(WONEExchangeV1.address),
      await provider.getBalance(WONEExchangeV1.address)
    ]
    const priceV1 = reservesV1[0].div(reservesV1[1])
    const reservesV2 = (await WONEPair.getReserves()).slice(0, 2)
    const priceV2 =
      WONEPairToken0 === WONEPartner.address ? reservesV2[0].div(reservesV2[1]) : reservesV2[1].div(reservesV2[0])

    expect(formatEther(profit)).to.eq('0.548043441089763649') // our profit is ~.5 ONE
    expect(priceV1.toString()).to.eq('143') // we pushed the v1 price up to ~143
    expect(priceV2.toString()).to.eq('161') // we pushed the v2 price down to ~161
  })
})
