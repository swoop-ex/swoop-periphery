import chai, { expect } from 'chai'
import { Contract } from 'ethers'
import { AddressZero, Zero, MaxUint256 } from 'ethers/constants'
import { BigNumber, bigNumberify } from 'ethers/utils'
import { solidity, MockProvider, createFixtureLoader } from 'ethereum-waffle'
import { ecsign } from 'ethereumjs-util'

import { expandTo18Decimals, getApprovalDigest, mineBlock, MINIMUM_LIQUIDITY } from './shared/utilities'
import { v2Fixture } from './shared/fixtures'

chai.use(solidity)

const overrides = {
  gasLimit: 9999999
}

enum RouterVersion {
  UniswapV2Router01 = 'UniswapV2Router01',
  UniswapV2Router02 = 'UniswapV2Router02'
}

describe('UniswapV2Router{01,02}', () => {
  for (const routerVersion of Object.keys(RouterVersion)) {
    const provider = new MockProvider({
      hardfork: 'istanbul',
      mnemonic: 'horn horn horn horn horn horn horn horn horn horn horn horn',
      gasLimit: 9999999
    })
    const [wallet] = provider.getWallets()
    const loadFixture = createFixtureLoader(provider, [wallet])

    let token0: Contract
    let token1: Contract
    let WONE: Contract
    let WONEPartner: Contract
    let factory: Contract
    let router: Contract
    let pair: Contract
    let WONEPair: Contract
    let routerEventEmitter: Contract
    beforeEach(async function() {
      const fixture = await loadFixture(v2Fixture)
      token0 = fixture.token0
      token1 = fixture.token1
      WONE = fixture.WONE
      WONEPartner = fixture.WONEPartner
      factory = fixture.factoryV2
      router = {
        [RouterVersion.UniswapV2Router01]: fixture.router01,
        [RouterVersion.UniswapV2Router02]: fixture.router02
      }[routerVersion as RouterVersion]
      pair = fixture.pair
      WONEPair = fixture.WONEPair
      routerEventEmitter = fixture.routerEventEmitter
    })

    afterEach(async function() {
      expect(await provider.getBalance(router.address)).to.eq(Zero)
    })

    describe(routerVersion, () => {
      it('factory, WONE', async () => {
        expect(await router.factory()).to.eq(factory.address)
        expect(await router.WONE()).to.eq(WONE.address)
      })

      it('addLiquidity', async () => {
        const token0Amount = expandTo18Decimals(1)
        const token1Amount = expandTo18Decimals(4)

        const expectedLiquidity = expandTo18Decimals(2)
        await token0.approve(router.address, MaxUint256)
        await token1.approve(router.address, MaxUint256)
        await expect(
          router.addLiquidity(
            token0.address,
            token1.address,
            token0Amount,
            token1Amount,
            0,
            0,
            wallet.address,
            MaxUint256,
            overrides
          )
        )
          .to.emit(token0, 'Transfer')
          .withArgs(wallet.address, pair.address, token0Amount)
          .to.emit(token1, 'Transfer')
          .withArgs(wallet.address, pair.address, token1Amount)
          .to.emit(pair, 'Transfer')
          .withArgs(AddressZero, AddressZero, MINIMUM_LIQUIDITY)
          .to.emit(pair, 'Transfer')
          .withArgs(AddressZero, wallet.address, expectedLiquidity.sub(MINIMUM_LIQUIDITY))
          .to.emit(pair, 'Sync')
          .withArgs(token0Amount, token1Amount)
          .to.emit(pair, 'Mint')
          .withArgs(router.address, token0Amount, token1Amount)

        expect(await pair.balanceOf(wallet.address)).to.eq(expectedLiquidity.sub(MINIMUM_LIQUIDITY))
      })

      it('addLiquidityONE', async () => {
        const WONEPartnerAmount = expandTo18Decimals(1)
        const ONEAmount = expandTo18Decimals(4)

        const expectedLiquidity = expandTo18Decimals(2)
        const WONEPairToken0 = await WONEPair.token0()
        await WONEPartner.approve(router.address, MaxUint256)
        await expect(
          router.addLiquidityONE(
            WONEPartner.address,
            WONEPartnerAmount,
            WONEPartnerAmount,
            ONEAmount,
            wallet.address,
            MaxUint256,
            { ...overrides, value: ONEAmount }
          )
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

      async function addLiquidity(token0Amount: BigNumber, token1Amount: BigNumber) {
        await token0.transfer(pair.address, token0Amount)
        await token1.transfer(pair.address, token1Amount)
        await pair.mint(wallet.address, overrides)
      }
      it('removeLiquidity', async () => {
        const token0Amount = expandTo18Decimals(1)
        const token1Amount = expandTo18Decimals(4)
        await addLiquidity(token0Amount, token1Amount)

        const expectedLiquidity = expandTo18Decimals(2)
        await pair.approve(router.address, MaxUint256)
        await expect(
          router.removeLiquidity(
            token0.address,
            token1.address,
            expectedLiquidity.sub(MINIMUM_LIQUIDITY),
            0,
            0,
            wallet.address,
            MaxUint256,
            overrides
          )
        )
          .to.emit(pair, 'Transfer')
          .withArgs(wallet.address, pair.address, expectedLiquidity.sub(MINIMUM_LIQUIDITY))
          .to.emit(pair, 'Transfer')
          .withArgs(pair.address, AddressZero, expectedLiquidity.sub(MINIMUM_LIQUIDITY))
          .to.emit(token0, 'Transfer')
          .withArgs(pair.address, wallet.address, token0Amount.sub(500))
          .to.emit(token1, 'Transfer')
          .withArgs(pair.address, wallet.address, token1Amount.sub(2000))
          .to.emit(pair, 'Sync')
          .withArgs(500, 2000)
          .to.emit(pair, 'Burn')
          .withArgs(router.address, token0Amount.sub(500), token1Amount.sub(2000), wallet.address)

        expect(await pair.balanceOf(wallet.address)).to.eq(0)
        const totalSupplyToken0 = await token0.totalSupply()
        const totalSupplyToken1 = await token1.totalSupply()
        expect(await token0.balanceOf(wallet.address)).to.eq(totalSupplyToken0.sub(500))
        expect(await token1.balanceOf(wallet.address)).to.eq(totalSupplyToken1.sub(2000))
      })

      it('removeLiquidityONE', async () => {
        const WONEPartnerAmount = expandTo18Decimals(1)
        const ONEAmount = expandTo18Decimals(4)
        await WONEPartner.transfer(WONEPair.address, WONEPartnerAmount)
        await WONE.deposit({ value: ONEAmount })
        await WONE.transfer(WONEPair.address, ONEAmount)
        await WONEPair.mint(wallet.address, overrides)

        const expectedLiquidity = expandTo18Decimals(2)
        const WONEPairToken0 = await WONEPair.token0()
        await WONEPair.approve(router.address, MaxUint256)
        await expect(
          router.removeLiquidityONE(
            WONEPartner.address,
            expectedLiquidity.sub(MINIMUM_LIQUIDITY),
            0,
            0,
            wallet.address,
            MaxUint256,
            overrides
          )
        )
          .to.emit(WONEPair, 'Transfer')
          .withArgs(wallet.address, WONEPair.address, expectedLiquidity.sub(MINIMUM_LIQUIDITY))
          .to.emit(WONEPair, 'Transfer')
          .withArgs(WONEPair.address, AddressZero, expectedLiquidity.sub(MINIMUM_LIQUIDITY))
          .to.emit(WONE, 'Transfer')
          .withArgs(WONEPair.address, router.address, ONEAmount.sub(2000))
          .to.emit(WONEPartner, 'Transfer')
          .withArgs(WONEPair.address, router.address, WONEPartnerAmount.sub(500))
          .to.emit(WONEPartner, 'Transfer')
          .withArgs(router.address, wallet.address, WONEPartnerAmount.sub(500))
          .to.emit(WONEPair, 'Sync')
          .withArgs(
            WONEPairToken0 === WONEPartner.address ? 500 : 2000,
            WONEPairToken0 === WONEPartner.address ? 2000 : 500
          )
          .to.emit(WONEPair, 'Burn')
          .withArgs(
            router.address,
            WONEPairToken0 === WONEPartner.address ? WONEPartnerAmount.sub(500) : ONEAmount.sub(2000),
            WONEPairToken0 === WONEPartner.address ? ONEAmount.sub(2000) : WONEPartnerAmount.sub(500),
            router.address
          )

        expect(await WONEPair.balanceOf(wallet.address)).to.eq(0)
        const totalSupplyWONEPartner = await WONEPartner.totalSupply()
        const totalSupplyWONE = await WONE.totalSupply()
        expect(await WONEPartner.balanceOf(wallet.address)).to.eq(totalSupplyWONEPartner.sub(500))
        expect(await WONE.balanceOf(wallet.address)).to.eq(totalSupplyWONE.sub(2000))
      })

      it('removeLiquidityWithPermit', async () => {
        const token0Amount = expandTo18Decimals(1)
        const token1Amount = expandTo18Decimals(4)
        await addLiquidity(token0Amount, token1Amount)

        const expectedLiquidity = expandTo18Decimals(2)

        const nonce = await pair.nonces(wallet.address)
        const digest = await getApprovalDigest(
          pair,
          { owner: wallet.address, spender: router.address, value: expectedLiquidity.sub(MINIMUM_LIQUIDITY) },
          nonce,
          MaxUint256
        )

        const { v, r, s } = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(wallet.privateKey.slice(2), 'hex'))

        await router.removeLiquidityWithPermit(
          token0.address,
          token1.address,
          expectedLiquidity.sub(MINIMUM_LIQUIDITY),
          0,
          0,
          wallet.address,
          MaxUint256,
          false,
          v,
          r,
          s,
          overrides
        )
      })

      it('removeLiquidityONEWithPermit', async () => {
        const WONEPartnerAmount = expandTo18Decimals(1)
        const ONEAmount = expandTo18Decimals(4)
        await WONEPartner.transfer(WONEPair.address, WONEPartnerAmount)
        await WONE.deposit({ value: ONEAmount })
        await WONE.transfer(WONEPair.address, ONEAmount)
        await WONEPair.mint(wallet.address, overrides)

        const expectedLiquidity = expandTo18Decimals(2)

        const nonce = await WONEPair.nonces(wallet.address)
        const digest = await getApprovalDigest(
          WONEPair,
          { owner: wallet.address, spender: router.address, value: expectedLiquidity.sub(MINIMUM_LIQUIDITY) },
          nonce,
          MaxUint256
        )

        const { v, r, s } = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(wallet.privateKey.slice(2), 'hex'))

        await router.removeLiquidityONEWithPermit(
          WONEPartner.address,
          expectedLiquidity.sub(MINIMUM_LIQUIDITY),
          0,
          0,
          wallet.address,
          MaxUint256,
          false,
          v,
          r,
          s,
          overrides
        )
      })

      describe('swapExactTokensForTokens', () => {
        const token0Amount = expandTo18Decimals(5)
        const token1Amount = expandTo18Decimals(10)
        const swapAmount = expandTo18Decimals(1)
        const expectedOutputAmount = bigNumberify('1662497915624478906')

        beforeEach(async () => {
          await addLiquidity(token0Amount, token1Amount)
          await token0.approve(router.address, MaxUint256)
        })

        it('happy path', async () => {
          await expect(
            router.swapExactTokensForTokens(
              swapAmount,
              0,
              [token0.address, token1.address],
              wallet.address,
              MaxUint256,
              overrides
            )
          )
            .to.emit(token0, 'Transfer')
            .withArgs(wallet.address, pair.address, swapAmount)
            .to.emit(token1, 'Transfer')
            .withArgs(pair.address, wallet.address, expectedOutputAmount)
            .to.emit(pair, 'Sync')
            .withArgs(token0Amount.add(swapAmount), token1Amount.sub(expectedOutputAmount))
            .to.emit(pair, 'Swap')
            .withArgs(router.address, swapAmount, 0, 0, expectedOutputAmount, wallet.address)
        })

        it('amounts', async () => {
          await token0.approve(routerEventEmitter.address, MaxUint256)
          await expect(
            routerEventEmitter.swapExactTokensForTokens(
              router.address,
              swapAmount,
              0,
              [token0.address, token1.address],
              wallet.address,
              MaxUint256,
              overrides
            )
          )
            .to.emit(routerEventEmitter, 'Amounts')
            .withArgs([swapAmount, expectedOutputAmount])
        })

        it('gas', async () => {
          // ensure that setting price{0,1}CumulativeLast for the first time doesn't affect our gas math
          await mineBlock(provider, (await provider.getBlock('latest')).timestamp + 1)
          await pair.sync(overrides)

          await token0.approve(router.address, MaxUint256)
          await mineBlock(provider, (await provider.getBlock('latest')).timestamp + 1)
          const tx = await router.swapExactTokensForTokens(
            swapAmount,
            0,
            [token0.address, token1.address],
            wallet.address,
            MaxUint256,
            overrides
          )
          const receipt = await tx.wait()
          expect(receipt.gasUsed).to.eq(
            {
              [RouterVersion.UniswapV2Router01]: 101876,
              [RouterVersion.UniswapV2Router02]: 101898
            }[routerVersion as RouterVersion]
          )
        }).retries(3)
      })

      describe('swapTokensForExactTokens', () => {
        const token0Amount = expandTo18Decimals(5)
        const token1Amount = expandTo18Decimals(10)
        const expectedSwapAmount = bigNumberify('557227237267357629')
        const outputAmount = expandTo18Decimals(1)

        beforeEach(async () => {
          await addLiquidity(token0Amount, token1Amount)
        })

        it('happy path', async () => {
          await token0.approve(router.address, MaxUint256)
          await expect(
            router.swapTokensForExactTokens(
              outputAmount,
              MaxUint256,
              [token0.address, token1.address],
              wallet.address,
              MaxUint256,
              overrides
            )
          )
            .to.emit(token0, 'Transfer')
            .withArgs(wallet.address, pair.address, expectedSwapAmount)
            .to.emit(token1, 'Transfer')
            .withArgs(pair.address, wallet.address, outputAmount)
            .to.emit(pair, 'Sync')
            .withArgs(token0Amount.add(expectedSwapAmount), token1Amount.sub(outputAmount))
            .to.emit(pair, 'Swap')
            .withArgs(router.address, expectedSwapAmount, 0, 0, outputAmount, wallet.address)
        })

        it('amounts', async () => {
          await token0.approve(routerEventEmitter.address, MaxUint256)
          await expect(
            routerEventEmitter.swapTokensForExactTokens(
              router.address,
              outputAmount,
              MaxUint256,
              [token0.address, token1.address],
              wallet.address,
              MaxUint256,
              overrides
            )
          )
            .to.emit(routerEventEmitter, 'Amounts')
            .withArgs([expectedSwapAmount, outputAmount])
        })
      })

      describe('swapExactONEForTokens', () => {
        const WONEPartnerAmount = expandTo18Decimals(10)
        const ONEAmount = expandTo18Decimals(5)
        const swapAmount = expandTo18Decimals(1)
        const expectedOutputAmount = bigNumberify('1662497915624478906')

        beforeEach(async () => {
          await WONEPartner.transfer(WONEPair.address, WONEPartnerAmount)
          await WONE.deposit({ value: ONEAmount })
          await WONE.transfer(WONEPair.address, ONEAmount)
          await WONEPair.mint(wallet.address, overrides)

          await token0.approve(router.address, MaxUint256)
        })

        it('happy path', async () => {
          const WONEPairToken0 = await WONEPair.token0()
          await expect(
            router.swapExactONEForTokens(0, [WONE.address, WONEPartner.address], wallet.address, MaxUint256, {
              ...overrides,
              value: swapAmount
            })
          )
            .to.emit(WONE, 'Transfer')
            .withArgs(router.address, WONEPair.address, swapAmount)
            .to.emit(WONEPartner, 'Transfer')
            .withArgs(WONEPair.address, wallet.address, expectedOutputAmount)
            .to.emit(WONEPair, 'Sync')
            .withArgs(
              WONEPairToken0 === WONEPartner.address
                ? WONEPartnerAmount.sub(expectedOutputAmount)
                : ONEAmount.add(swapAmount),
              WONEPairToken0 === WONEPartner.address
                ? ONEAmount.add(swapAmount)
                : WONEPartnerAmount.sub(expectedOutputAmount)
            )
            .to.emit(WONEPair, 'Swap')
            .withArgs(
              router.address,
              WONEPairToken0 === WONEPartner.address ? 0 : swapAmount,
              WONEPairToken0 === WONEPartner.address ? swapAmount : 0,
              WONEPairToken0 === WONEPartner.address ? expectedOutputAmount : 0,
              WONEPairToken0 === WONEPartner.address ? 0 : expectedOutputAmount,
              wallet.address
            )
        })

        it('amounts', async () => {
          await expect(
            routerEventEmitter.swapExactONEForTokens(
              router.address,
              0,
              [WONE.address, WONEPartner.address],
              wallet.address,
              MaxUint256,
              {
                ...overrides,
                value: swapAmount
              }
            )
          )
            .to.emit(routerEventEmitter, 'Amounts')
            .withArgs([swapAmount, expectedOutputAmount])
        })

        it('gas', async () => {
          const WONEPartnerAmount = expandTo18Decimals(10)
          const ONEAmount = expandTo18Decimals(5)
          await WONEPartner.transfer(WONEPair.address, WONEPartnerAmount)
          await WONE.deposit({ value: ONEAmount })
          await WONE.transfer(WONEPair.address, ONEAmount)
          await WONEPair.mint(wallet.address, overrides)

          // ensure that setting price{0,1}CumulativeLast for the first time doesn't affect our gas math
          await mineBlock(provider, (await provider.getBlock('latest')).timestamp + 1)
          await pair.sync(overrides)

          const swapAmount = expandTo18Decimals(1)
          await mineBlock(provider, (await provider.getBlock('latest')).timestamp + 1)
          const tx = await router.swapExactONEForTokens(
            0,
            [WONE.address, WONEPartner.address],
            wallet.address,
            MaxUint256,
            {
              ...overrides,
              value: swapAmount
            }
          )
          const receipt = await tx.wait()
          expect(receipt.gasUsed).to.eq(
            {
              [RouterVersion.UniswapV2Router01]: 138770,
              [RouterVersion.UniswapV2Router02]: 138770
            }[routerVersion as RouterVersion]
          )
        }).retries(3)
      })

      describe('swapTokensForExactONE', () => {
        const WONEPartnerAmount = expandTo18Decimals(5)
        const ONEAmount = expandTo18Decimals(10)
        const expectedSwapAmount = bigNumberify('557227237267357629')
        const outputAmount = expandTo18Decimals(1)

        beforeEach(async () => {
          await WONEPartner.transfer(WONEPair.address, WONEPartnerAmount)
          await WONE.deposit({ value: ONEAmount })
          await WONE.transfer(WONEPair.address, ONEAmount)
          await WONEPair.mint(wallet.address, overrides)
        })

        it('happy path', async () => {
          await WONEPartner.approve(router.address, MaxUint256)
          const WONEPairToken0 = await WONEPair.token0()
          await expect(
            router.swapTokensForExactONE(
              outputAmount,
              MaxUint256,
              [WONEPartner.address, WONE.address],
              wallet.address,
              MaxUint256,
              overrides
            )
          )
            .to.emit(WONEPartner, 'Transfer')
            .withArgs(wallet.address, WONEPair.address, expectedSwapAmount)
            .to.emit(WONE, 'Transfer')
            .withArgs(WONEPair.address, router.address, outputAmount)
            .to.emit(WONEPair, 'Sync')
            .withArgs(
              WONEPairToken0 === WONEPartner.address
                ? WONEPartnerAmount.add(expectedSwapAmount)
                : ONEAmount.sub(outputAmount),
              WONEPairToken0 === WONEPartner.address
                ? ONEAmount.sub(outputAmount)
                : WONEPartnerAmount.add(expectedSwapAmount)
            )
            .to.emit(WONEPair, 'Swap')
            .withArgs(
              router.address,
              WONEPairToken0 === WONEPartner.address ? expectedSwapAmount : 0,
              WONEPairToken0 === WONEPartner.address ? 0 : expectedSwapAmount,
              WONEPairToken0 === WONEPartner.address ? 0 : outputAmount,
              WONEPairToken0 === WONEPartner.address ? outputAmount : 0,
              router.address
            )
        })

        it('amounts', async () => {
          await WONEPartner.approve(routerEventEmitter.address, MaxUint256)
          await expect(
            routerEventEmitter.swapTokensForExactONE(
              router.address,
              outputAmount,
              MaxUint256,
              [WONEPartner.address, WONE.address],
              wallet.address,
              MaxUint256,
              overrides
            )
          )
            .to.emit(routerEventEmitter, 'Amounts')
            .withArgs([expectedSwapAmount, outputAmount])
        })
      })

      describe('swapExactTokensForONE', () => {
        const WONEPartnerAmount = expandTo18Decimals(5)
        const ONEAmount = expandTo18Decimals(10)
        const swapAmount = expandTo18Decimals(1)
        const expectedOutputAmount = bigNumberify('1662497915624478906')

        beforeEach(async () => {
          await WONEPartner.transfer(WONEPair.address, WONEPartnerAmount)
          await WONE.deposit({ value: ONEAmount })
          await WONE.transfer(WONEPair.address, ONEAmount)
          await WONEPair.mint(wallet.address, overrides)
        })

        it('happy path', async () => {
          await WONEPartner.approve(router.address, MaxUint256)
          const WONEPairToken0 = await WONEPair.token0()
          await expect(
            router.swapExactTokensForONE(
              swapAmount,
              0,
              [WONEPartner.address, WONE.address],
              wallet.address,
              MaxUint256,
              overrides
            )
          )
            .to.emit(WONEPartner, 'Transfer')
            .withArgs(wallet.address, WONEPair.address, swapAmount)
            .to.emit(WONE, 'Transfer')
            .withArgs(WONEPair.address, router.address, expectedOutputAmount)
            .to.emit(WONEPair, 'Sync')
            .withArgs(
              WONEPairToken0 === WONEPartner.address
                ? WONEPartnerAmount.add(swapAmount)
                : ONEAmount.sub(expectedOutputAmount),
              WONEPairToken0 === WONEPartner.address
                ? ONEAmount.sub(expectedOutputAmount)
                : WONEPartnerAmount.add(swapAmount)
            )
            .to.emit(WONEPair, 'Swap')
            .withArgs(
              router.address,
              WONEPairToken0 === WONEPartner.address ? swapAmount : 0,
              WONEPairToken0 === WONEPartner.address ? 0 : swapAmount,
              WONEPairToken0 === WONEPartner.address ? 0 : expectedOutputAmount,
              WONEPairToken0 === WONEPartner.address ? expectedOutputAmount : 0,
              router.address
            )
        })

        it('amounts', async () => {
          await WONEPartner.approve(routerEventEmitter.address, MaxUint256)
          await expect(
            routerEventEmitter.swapExactTokensForONE(
              router.address,
              swapAmount,
              0,
              [WONEPartner.address, WONE.address],
              wallet.address,
              MaxUint256,
              overrides
            )
          )
            .to.emit(routerEventEmitter, 'Amounts')
            .withArgs([swapAmount, expectedOutputAmount])
        })
      })

      describe('swapONEForExactTokens', () => {
        const WONEPartnerAmount = expandTo18Decimals(10)
        const ONEAmount = expandTo18Decimals(5)
        const expectedSwapAmount = bigNumberify('557227237267357629')
        const outputAmount = expandTo18Decimals(1)

        beforeEach(async () => {
          await WONEPartner.transfer(WONEPair.address, WONEPartnerAmount)
          await WONE.deposit({ value: ONEAmount })
          await WONE.transfer(WONEPair.address, ONEAmount)
          await WONEPair.mint(wallet.address, overrides)
        })

        it('happy path', async () => {
          const WONEPairToken0 = await WONEPair.token0()
          await expect(
            router.swapONEForExactTokens(
              outputAmount,
              [WONE.address, WONEPartner.address],
              wallet.address,
              MaxUint256,
              {
                ...overrides,
                value: expectedSwapAmount
              }
            )
          )
            .to.emit(WONE, 'Transfer')
            .withArgs(router.address, WONEPair.address, expectedSwapAmount)
            .to.emit(WONEPartner, 'Transfer')
            .withArgs(WONEPair.address, wallet.address, outputAmount)
            .to.emit(WONEPair, 'Sync')
            .withArgs(
              WONEPairToken0 === WONEPartner.address
                ? WONEPartnerAmount.sub(outputAmount)
                : ONEAmount.add(expectedSwapAmount),
              WONEPairToken0 === WONEPartner.address
                ? ONEAmount.add(expectedSwapAmount)
                : WONEPartnerAmount.sub(outputAmount)
            )
            .to.emit(WONEPair, 'Swap')
            .withArgs(
              router.address,
              WONEPairToken0 === WONEPartner.address ? 0 : expectedSwapAmount,
              WONEPairToken0 === WONEPartner.address ? expectedSwapAmount : 0,
              WONEPairToken0 === WONEPartner.address ? outputAmount : 0,
              WONEPairToken0 === WONEPartner.address ? 0 : outputAmount,
              wallet.address
            )
        })

        it('amounts', async () => {
          await expect(
            routerEventEmitter.swapONEForExactTokens(
              router.address,
              outputAmount,
              [WONE.address, WONEPartner.address],
              wallet.address,
              MaxUint256,
              {
                ...overrides,
                value: expectedSwapAmount
              }
            )
          )
            .to.emit(routerEventEmitter, 'Amounts')
            .withArgs([expectedSwapAmount, outputAmount])
        })
      })
    })
  }
})
