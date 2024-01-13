import chai from 'chai';
import {
  EXCHANGE_RATE_GX_USD,
  FUNCTION_PARAMETER_A,
  FUNCTION_PARAMETER_B,
  FUNCTION_PARAMETER_C,
  FUNCTION_PARAMETER_D,
  TIME_EFFECT_DECAYING_SLOPE,
  TIME_EFFECT_INITIAL_FACTOR,
  TIME_EFFECT_MINUTE_TO_DEADLINE,
  USD_CAP,
  computeFactor,
  computeG1ToGxConversion,
  computeUSDtoG1Ratio,
  getGxAfterMVU,
  getGxAfterMVUWithTimeEffect,
  getGxBeforeMVU,
  getGxFromG1,
  getGxFromUSD,
  getTotalUSD,
  getUserTgeBalance,
} from '../../utils/g1gx';
import * as time from '../../utils/time';
import Sinon from 'sinon';
import * as web3 from '../../utils/web3';
import { getCollectionUsersMock, mockUserHandle, mockUserName } from '../utils';
import chaiAsPromised from 'chai-as-promised';

chai.use(chaiAsPromised);
const { expect } = chai;

describe('G1 to GX util functions', async function () {
  let sandbox: Sinon.SinonSandbox;
  let minutesUntilJanFirst2024Stub;
  let collectionUsersMock;
  let balanceMock;

  beforeEach(async function () {
    collectionUsersMock = await getCollectionUsersMock();

    sandbox = Sinon.createSandbox();
    minutesUntilJanFirst2024Stub = sandbox
      .stub(time, 'minutesUntilTgeEnd')
      .returns(20000);

    balanceMock = sandbox.stub(web3, 'getUserBalance').resolves('10');
  });

  afterEach(function () {
    sandbox.restore();
  });

  describe('computeUSDtoG1Ratio function', async function () {
    it('Should return the correct ratio when USD quantity is greater than G1 quantity', async function () {
      const usdQuantity = 100;
      const g1Quantity = 50;
      const expectedRatio = 2;

      const result = computeUSDtoG1Ratio(usdQuantity, g1Quantity);
      expect(result).to.equal(expectedRatio);
    });

    it('Should return the correct ratio when G1 quantity is greater than USD quantity', async function () {
      const usdQuantity = 50;
      const g1Quantity = 100;
      const expectedRatio = 0.5;

      const result = computeUSDtoG1Ratio(usdQuantity, g1Quantity);
      expect(result).to.equal(expectedRatio);
    });

    it('Should return the correct ratio with lots of G1', async function () {
      const usdQuantity = 100;
      const g1Quantity = 5000000000;
      const expectedRatio = 0.00000002;

      const result = computeUSDtoG1Ratio(usdQuantity, g1Quantity);

      expect(result).to.equal(expectedRatio);
    });

    it('Should handle a G1 quantity of 0 and throw an error', async function () {
      const usdQuantity = 50;
      const g1Quantity = 0;

      expect(() => computeUSDtoG1Ratio(usdQuantity, g1Quantity)).to.throw(
        'G1 quantity cannot be zero.',
      );
    });
  });

  describe('computeFactor function', async function () {
    it('Should handle a G1 quantity of 0 and throw an error', async function () {
      const usdQuantity = 50;
      const g1Quantity = 0;

      expect(() => computeFactor(usdQuantity, g1Quantity)).to.throw(
        'G1 quantity cannot be zero.',
      );
    });

    it('Should return the correct factor when USD quantity is 0', async function () {
      const usdQuantity = 0;
      const g1Quantity = 10;

      const result = computeFactor(usdQuantity, g1Quantity);
      expect(result.toFixed(2)).to.equal(Number(5).toFixed(2));
    });

    it('Should return the correct factor when USD quantity is greater than 0 and G1 quantity is greater than 0', async function () {
      const usdQuantity = 100;
      const g1Quantity = 50;

      const result = computeFactor(usdQuantity, g1Quantity);
      expect(result.toFixed(2)).to.equal(Number(5).toFixed(2));
    });

    it('Should return the correct factor with lots of G1', async function () {
      const usdQuantity = 100;
      const g1Quantity = 5000000000;

      const result = computeFactor(usdQuantity, g1Quantity);

      expect(Number(result).toFixed(8)).to.equal(Number(0.00002232).toFixed(8));
    });
  });

  describe('Conversion functions', async function () {
    it('getGxFromUSD should convert USD to GX correctly', async function () {
      const usdQuantity = 100;

      const result = getGxFromUSD(usdQuantity);

      expect(result).to.equal(usdQuantity / 0.036);
    });

    it('getGxFromG1 should convert G1 to GX correctly', async function () {
      const g1Quantity = 50;
      const usdQuantity = 100;

      const result = getGxFromG1(usdQuantity, g1Quantity);

      expect(result).to.equal(
        (g1Quantity / 1000 / 0.036) *
          FUNCTION_PARAMETER_A *
          (1 - Math.exp(-FUNCTION_PARAMETER_B * 2)),
      );
    });

    it('getGxFromUSD should handle a 0 USD quantity', async function () {
      const usdQuantity = 0;

      const result = getGxFromUSD(usdQuantity);
      expect(result).to.equal(0);
    });

    it('getGxFromG1 should handle a 0 G1 quantity', async function () {
      const g1Quantity = 0;
      const usdQuantity = 100;

      expect(() => computeUSDtoG1Ratio(usdQuantity, g1Quantity)).to.throw(
        'G1 quantity cannot be zero.',
      );
    });
  });

  describe('getGxBeforeMVU function', async function () {
    it('Should return the correct value for Gx before MVU when both quantities are greater than 0', async function () {
      const usdQuantity = 100;
      const g1Quantity = 50;
      const expectedGxBeforeMVU =
        getGxFromG1(usdQuantity, g1Quantity) + usdQuantity / 0.036;

      const result = getGxBeforeMVU(usdQuantity, g1Quantity);
      expect(result).to.equal(expectedGxBeforeMVU);
    });

    it('Should return the correct value for Gx before MVU when G1 quantity is 0', async function () {
      const usdQuantity = 100;
      const g1Quantity = 0;

      expect(() => getGxBeforeMVU(usdQuantity, g1Quantity)).to.throw(
        'G1 quantity cannot be zero.',
      );
    });

    it('Should return the correct value for Gx before MVU when USD quantity is 0', async function () {
      const usdQuantity = 0;
      const g1Quantity = 50;
      const expectedGxBeforeMVU = getGxFromG1(usdQuantity, g1Quantity);

      const result = getGxBeforeMVU(usdQuantity, g1Quantity);
      expect(result).to.equal(expectedGxBeforeMVU);
    });

    it('Should return 0 when both USD and G1 quantities are 0', async function () {
      const usdQuantity = 0;
      const g1Quantity = 0;

      expect(() => getGxBeforeMVU(usdQuantity, g1Quantity)).to.throw(
        'G1 quantity cannot be zero.',
      );
    });
  });

  describe('getGxAfterMVU function', async function () {
    it('Should return the correct value when the total GX exceeds the USD cap', async function () {
      const usdQuantity = 100;
      const g1Quantity = 50;
      const mvu = 10;

      const gxFromUSD = getGxFromUSD(usdQuantity);
      const gxFromG1 = getGxFromG1(usdQuantity, g1Quantity);

      const expectedGxAfterMVU =
        (FUNCTION_PARAMETER_C * Math.pow(mvu, 2) + FUNCTION_PARAMETER_D) *
        (gxFromUSD + gxFromG1);

      const result = getGxAfterMVU(usdQuantity, g1Quantity, mvu);
      expect(result).to.equal(expectedGxAfterMVU);
    });

    it('Should return the correct value when the total GX does not exceed the USD cap', async function () {
      const usdQuantity = 10000000;
      const g1Quantity = 20;
      const mvu = 4;

      const intermediateValue =
        FUNCTION_PARAMETER_C * Math.pow(mvu, 2) + FUNCTION_PARAMETER_D;
      const gxFromUSD = getGxFromUSD(usdQuantity);
      const gxFromG1 = getGxFromG1(usdQuantity, g1Quantity);

      const expectedGxAfterMVU =
        intermediateValue * (USD_CAP * EXCHANGE_RATE_GX_USD) +
        (gxFromUSD + gxFromG1 - USD_CAP * EXCHANGE_RATE_GX_USD);

      const result = getGxAfterMVU(usdQuantity, g1Quantity, mvu);
      expect(result).to.equal(expectedGxAfterMVU);
    });
  });

  describe('getGxAfterMVUWithTimeEffect function', async function () {
    it('Should return the correct value considering time effect when time left is less than minutes until Jan 1, 2024', async function () {
      const usdQuantity = 100;
      const g1Quantity = 50;
      const mvu = 10;

      const expectedGxAfterMVU = getGxAfterMVU(usdQuantity, g1Quantity, mvu);

      const maxDifference = Math.max(
        TIME_EFFECT_MINUTE_TO_DEADLINE - time.minutesUntilTgeEnd(),
        0,
      );
      const expectedGxAfterMVUWithTimeEffect =
        expectedGxAfterMVU *
        (TIME_EFFECT_INITIAL_FACTOR -
          TIME_EFFECT_DECAYING_SLOPE * maxDifference);

      const result = getGxAfterMVUWithTimeEffect(usdQuantity, g1Quantity, mvu);
      expect(result).to.equal(expectedGxAfterMVUWithTimeEffect);
    });

    it('Should return the same value as getGxAfterMVU when time left is time left is equal minutesUntilTgeEnd', async function () {
      minutesUntilJanFirst2024Stub.returns(TIME_EFFECT_MINUTE_TO_DEADLINE);

      const usdQuantity = 100;
      const g1Quantity = 50;
      const mvu = 10;

      const expectedGxAfterMVU =
        getGxAfterMVU(usdQuantity, g1Quantity, mvu) *
        TIME_EFFECT_INITIAL_FACTOR;
      const result = getGxAfterMVUWithTimeEffect(usdQuantity, g1Quantity, mvu);
      expect(result).to.equal(expectedGxAfterMVU);
    });
  });

  describe('getTotalUSD function', async function () {
    it('Should return the correct total USD based on the calculated GX after MVU with time effect', async function () {
      const usdQuantity = 100;
      const g1Quantity = 50;
      const mvu = 10;

      const expectedGxAfterMVU = getGxAfterMVU(usdQuantity, g1Quantity, mvu);

      const maxDifference = Math.max(
        TIME_EFFECT_MINUTE_TO_DEADLINE - time.minutesUntilTgeEnd(),
        0,
      );
      const expectedGxAfterMVUWithTimeEffect =
        expectedGxAfterMVU *
        (TIME_EFFECT_INITIAL_FACTOR -
          TIME_EFFECT_DECAYING_SLOPE * maxDifference);

      const result = getTotalUSD(usdQuantity, g1Quantity, mvu);
      expect(result).to.equal(
        expectedGxAfterMVUWithTimeEffect / EXCHANGE_RATE_GX_USD,
      );
    });
  });

  describe('computeG1ToGxConversion function', async function () {
    it('computeG1ToGxConversion function straight example', async function () {
      const usdQuantity = 100;
      const g1Quantity = 50;
      const mvu = 4;

      const result = computeG1ToGxConversion(usdQuantity, g1Quantity, mvu);

      expect(result.usdFromUsdInvestment).to.equal(Number(100).toFixed(2));
      expect(result.usdFromG1Investment).to.equal(Number(0.25).toFixed(2));
      expect(result.usdFromMvu).to.equal(Number(8.02).toFixed(2));
      expect(result.usdFromTime).to.equal(Number(13.7).toFixed(2));
      expect(result.equivalentUsdInvested).to.equal(Number(121.97).toFixed(2));

      expect(result.gxBeforeMvu).to.equal(Number(2784.72).toFixed(2));
      expect(result.gxMvuEffect).to.equal(Number(222.78).toFixed(2));
      expect(result.gxTimeEffect).to.equal(Number(380.5).toFixed(2));
      expect(result.GxUsdExchangeRate).to.equal(Number(33.8).toFixed(2));

      expect(result.standardGxUsdExchangeRate).to.equal(
        Number(27.78).toFixed(2),
      );

      expect(result.discountReceived).to.equal(Number(17.81).toFixed(2));
    });

    it('computeG1ToGxConversion function with lots of G1', async function () {
      const usdQuantity = 100;
      const g1Quantity = 5000000000;
      const mvu = 4;

      const result = computeG1ToGxConversion(usdQuantity, g1Quantity, mvu);

      expect(result.tokenAmountG1).to.equal(Number(5000000000).toFixed(2));
      expect(result.usdFromUsdInvestment).to.equal(Number(100).toFixed(2));
      expect(result.usdFromG1Investment).to.equal(Number(111.59).toFixed(2));
      expect(result.usdFromMvu).to.equal(Number(16.93).toFixed(2));
      expect(result.usdFromTime).to.equal(Number(28.91).toFixed(2));
      expect(result.equivalentUsdInvested).to.equal(Number(257.43).toFixed(2));

      expect(result.gxBeforeMvu).to.equal(Number(5877.44).toFixed(2));
      expect(result.gxMvuEffect).to.equal(Number(470.19).toFixed(2));
      expect(result.gxTimeEffect).to.equal(Number(803.09).toFixed(2));
      expect(result.GxUsdExchangeRate).to.equal(Number(33.8).toFixed(2));

      expect(result.standardGxUsdExchangeRate).to.equal(
        Number(27.78).toFixed(2),
      );

      expect(result.discountReceived).to.equal(Number(17.81).toFixed(2));
    });
  });

  describe('Compute user balance specific for TGE', async function () {
    beforeEach(async function () {
      await collectionUsersMock.insertMany([
        {
          userTelegramID: '5958052954',
          responsePath: '64d170d6dc5a2a00578ad6g6/c/5958052945',
          userHandle: 'handlee',
          userName: 'my test',
          patchwallet: '0xa464c89DF10D81728D8E62D7158ce646056854D6',
        },
        {
          userTelegramID: '5113589246',
          responsePath: '64d170d6dfda2a00578ad6f6/c/5113585446',
          userHandle: mockUserHandle,
          userName: mockUserName,
          patchwallet: '0x18aC20c78aB8eeB178bb0a0bD2389ea95edd699c',
          attributes: {
            aff_score: null,
            balance_100123: '1000',
            host_score: '3',
            isActiveUser: false,
            isBlacklist: false,
            isContributeUser: true,
            isDead: false,
            isDoubleSpent: false,
            isDrone: false,
            isDroneOwner: false,
            isGamer: false,
            isSlave: false,
            isWalkingDead: false,
            mvu_rounded: '7',
            mvu_score: '7.35',
            virtual_balance: '30000',
          },
        },
        {
          userTelegramID: '5113589244',
          responsePath: '64d170d6dfda2a00578ad6f6/c/5113585446',
          userHandle: mockUserHandle,
          userName: mockUserName,
          patchwallet: '0x18aC20c78aB8eeB178bb0a0bD2389ea95edd699c',
          attributes: {
            aff_score: null,
            host_score: '3',
            isActiveUser: false,
            isBlacklist: false,
            isContributeUser: true,
            isDead: false,
            isDoubleSpent: false,
            isDrone: false,
            isDroneOwner: false,
            isGamer: false,
            isSlave: false,
            isWalkingDead: false,
            mvu_rounded: '7',
            mvu_score: '7.35',
            virtual_balance: '30000',
          },
        },
      ]);
    });

    it('Should throw an error if amount to trade is higher than balance', async function () {
      await expect(getUserTgeBalance('5113589246', 200)).to.be.rejectedWith(
        Error,
        'Amount of G1 to trade (200) is too high compared to your current balance (10)',
      );
    });

    it('Should return user amount scaled by real balance (balance snapshot irrelevant) if virtual balance higher than current balance', async function () {
      expect(await getUserTgeBalance('5113589246', 2)).to.equal(6000);
    });

    it('Should return user amount scaled by real balance if virtual balance higher than current balance and no balance snapshot available', async function () {
      expect(await getUserTgeBalance('5113589244', 2)).to.equal(6000);
    });

    it('Should return user amount if virtual balance lower than current balance', async function () {
      balanceMock.resolves('300000');
      expect(await getUserTgeBalance('5113589246', 2)).to.equal(2);
    });

    it('Should return user amount scaled by real balance if current balance higher than balance snapshot (but lower than virtual balance)', async function () {
      balanceMock.resolves('10000');
      expect(await getUserTgeBalance('5113589246', 5000)).to.equal(15000);
    });
  });
});
