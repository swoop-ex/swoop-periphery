import chai, { expect } from 'chai'
import { Contract } from 'ethers'
import { AddressZero, MaxUint256 } from 'ethers/constants'
import { bigNumberify } from 'ethers/utils'
import { solidity, MockProvider, createFixtureLoader } from 'ethereum-waffle'

import { v2Fixture } from './shared/fixtures'
import { expandTo18Decimals, MINIMUM_LIQUIDITY } from './shared/utilities'

chai.use(solidity)

const overrides = {
  gasLimit: 9999999
}

describe('UniswapV2Migrator', () => {
  const provider = new MockProvider({
    hardfork: 'istanbul',
    mnemonic: 'horn horn horn horn horn horn horn horn horn horn horn horn',
    gasLimit: 9999999
  })
  const [wallet] = provider.getWallets()
  const loadFixture = createFixtureLoader(provider, [wallet])

  let WONEPartner: Contract
  let WONEPair: Contract
  let router: Contract
  let migrator: Contract
  let WONEExchangeV1: Contract
  beforeEach(async function() {
    const fixture = await loadFixture(v2Fixture)
    WONEPartner = fixture.WONEPartner
    WONEPair = fixture.WONEPair
    router = fixture.router01 // we used router01 for this contract
    migrator = fixture.migrator
    WONEExchangeV1 = fixture.WONEExchangeV1
  })

  it('migrate', async () => {
    const WONEPartnerAmount = expandTo18Decimals(1)
    const ONEAmount = expandTo18Decimals(4)
    await WONEPartner.approve(WONEExchangeV1.address, MaxUint256)
    await WONEExchangeV1.addLiquidity(bigNumberify(1), WONEPartnerAmount, MaxUint256, {
      ...overrides,
      value: ONEAmount
    })
    await WONEExchangeV1.approve(migrator.address, MaxUint256)
    const expectedLiquidity = expandTo18Decimals(2)
    const WONEPairToken0 = await WONEPair.token0()
    await expect(
      migrator.migrate(WONEPartner.address, WONEPartnerAmount, ONEAmount, wallet.address, MaxUint256, overrides)
    )
      .to.emit(WONEPair, 'Transfer')
      .withArgs(AddressZero, AddressZero, MINIMUM_LIQUIDITY)
      .to.emit(WONEPair, 'Transfer')
      .withArgs(AddressZero, wallet.address, expectedLiquidity.sub(MINIMUM_LIQUIDITY))
      .to.emit(WONEPair, 'Sync')
      .withArgs(
        WONEPairToken0 === WONEPartner.address ? WONEPartnerAmount : ONEAmount,
        WONEPairToken0 === WONEPartner.address ? ONEAmount : WONEPartnerAmount
      )
      .to.emit(WONEPair, 'Mint')
      .withArgs(
        router.address,
        WONEPairToken0 === WONEPartner.address ? WONEPartnerAmount : ONEAmount,
        WONEPairToken0 === WONEPartner.address ? ONEAmount : WONEPartnerAmount
      )
    expect(await WONEPair.balanceOf(wallet.address)).to.eq(expectedLiquidity.sub(MINIMUM_LIQUIDITY))
  })
})
