import chai from 'chai';
import {
  GX_USD_CONV,
  computeG1ToGxConversion,
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
  let collectionUsersMock;
  let balanceMock;

  beforeEach(async function () {
    collectionUsersMock = await getCollectionUsersMock();

    sandbox = Sinon.createSandbox();
    sandbox.stub(time, 'daysSinceStartDate').returns(1);

    balanceMock = sandbox.stub(web3, 'getUserBalanceERC20').resolves('10');
  });

  afterEach(function () {
    sandbox.restore();
  });

  describe('G1/USD to GX conversion function', async function () {
    it('Case 21', async function () {
      expect(computeG1ToGxConversion(1000000, 1000000, 10, 1)).to.deep.equal({
        m1: '0.0400',
        m2: '0.0103',
        m3: '0.0300',
        m4: '0.0000',
        m5: '0.2500',
        m6: '0.3303',
        finalG1Usd: '0.001232',
        gxFromUsd: '277.78',
        usdFromG1: '1231.96',
        gxFromG1: '34220.97',
        gxReceived: '34498.75',
        equivalentUsdInvested: '1241.96',
        GxUsdExchangeRate: GX_USD_CONV.toFixed(2),
      });
    });

    it('Case 22', async function () {
      expect(computeG1ToGxConversion(1, 1, 10, 1)).to.deep.equal({
        m1: '0.0400',
        m2: '0.4000',
        m3: '0.0300',
        m4: '0.0000',
        m5: '0.2500',
        m6: '0.7200',
        finalG1Usd: '0.002261',
        gxFromUsd: '277.78',
        usdFromG1: '0.00',
        gxFromG1: '0.06',
        gxReceived: '277.84',
        equivalentUsdInvested: '10.00',
        GxUsdExchangeRate: GX_USD_CONV.toFixed(2),
      });
    });

    it('Case 23', async function () {
      expect(computeG1ToGxConversion(500, 500, 0, 4)).to.deep.equal({
        m1: '0.0000',
        m2: '0.0000',
        m3: '0.1200',
        m4: '0.0000',
        m5: '0.2500',
        m6: '0.3700',
        finalG1Usd: '0.001337',
        gxFromUsd: '0.00',
        usdFromG1: '0.67',
        gxFromG1: '18.57',
        gxReceived: '18.57',
        equivalentUsdInvested: '0.67',
        GxUsdExchangeRate: GX_USD_CONV.toFixed(2),
      });
    });

    it('Case 33', async function () {
      expect(computeG1ToGxConversion(2000000, 1900000, 20, 4)).to.deep.equal({
        m1: '0.0800',
        m2: '0.0189',
        m3: '0.1200',
        m4: '0.0000',
        m5: '0.2500',
        m6: '0.4689',
        finalG1Usd: '0.001598',
        gxFromUsd: '555.56',
        usdFromG1: '3035.82',
        gxFromG1: '84328.42',
        gxReceived: '84883.98',
        equivalentUsdInvested: '3055.82',
        GxUsdExchangeRate: GX_USD_CONV.toFixed(2),
      });
    });

    it('Case 34', async function () {
      expect(computeG1ToGxConversion(2000000, 1900000, 120, 4)).to.deep.equal({
        m1: '0.2000',
        m2: '0.1132',
        m3: '0.1200',
        m4: '0.0000',
        m5: '0.2500',
        m6: '0.6832',
        finalG1Usd: '0.002164',
        gxFromUsd: '3333.33',
        usdFromG1: '4110.86',
        gxFromG1: '114190.53',
        gxReceived: '117523.86',
        equivalentUsdInvested: '4230.86',
        GxUsdExchangeRate: GX_USD_CONV.toFixed(2),
      });
    });

    it('Case 35', async function () {
      expect(
        computeG1ToGxConversion(120000000, 120000000, 180, 10),
      ).to.deep.equal({
        m1: '0.2000',
        m2: '0.1105',
        m3: '0.3000',
        m4: '0.0000',
        m5: '0.2500',
        m6: '0.8605',
        finalG1Usd: '0.002632',
        gxFromUsd: '5000.00',
        usdFromG1: '315812.90',
        gxFromG1: '8772580.69',
        gxReceived: '8777580.69',
        equivalentUsdInvested: '315992.90',
        GxUsdExchangeRate: GX_USD_CONV.toFixed(2),
      });
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
