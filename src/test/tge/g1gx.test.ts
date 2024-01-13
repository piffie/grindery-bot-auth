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

    balanceMock = sandbox.stub(web3, 'getUserBalance').resolves('10');
  });

  afterEach(function () {
    sandbox.restore();
  });

  describe('G1/USD to GX conversion function', async function () {
    it('Case 21', async function () {
      expect(computeG1ToGxConversion(1000000, 1000000, 10, 1)).to.deep.equal({
        m1: '0.0400',
        m2: '0.0365',
        m3: '0.0300',
        m4: '0.0000',
        m5: '0.2500',
        m6: '0.3565',
        finalG1Usd: '0.002168',
        gxFromUsd: '277.78',
        usdFromG1: '2168.50',
        gxFromG1: '60236.09',
        gxReceived: '60513.87',
        equivalentUsdInvested: '2178.50',
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
        finalG1Usd: '0.003768',
        gxFromUsd: '277.78',
        usdFromG1: '0.00',
        gxFromG1: '0.10',
        gxReceived: '277.88',
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
        finalG1Usd: '0.002228',
        gxFromUsd: '0.00',
        usdFromG1: '1.11',
        gxFromG1: '30.94',
        gxReceived: '30.94',
        equivalentUsdInvested: '1.11',
        GxUsdExchangeRate: GX_USD_CONV.toFixed(2),
      });
    });

    it('Case 33', async function () {
      expect(computeG1ToGxConversion(2000000, 1900000, 20, 4)).to.deep.equal({
        m1: '0.0800',
        m2: '0.0673',
        m3: '0.1200',
        m4: '0.0000',
        m5: '0.2500',
        m6: '0.5173',
        finalG1Usd: '0.002876',
        gxFromUsd: '555.56',
        usdFromG1: '5464.41',
        gxFromG1: '151789.03',
        gxReceived: '152344.59',
        equivalentUsdInvested: '5484.41',
        GxUsdExchangeRate: GX_USD_CONV.toFixed(2),
      });
    });

    it('Case 34', async function () {
      expect(computeG1ToGxConversion(2000000, 1900000, 120, 4)).to.deep.equal({
        m1: '0.2000',
        m2: '0.4000',
        m3: '0.1200',
        m4: '0.0000',
        m5: '0.2500',
        m6: '0.9700',
        finalG1Usd: '0.004868',
        gxFromUsd: '3333.33',
        usdFromG1: '9249.20',
        gxFromG1: '256922.22',
        gxReceived: '260255.56',
        equivalentUsdInvested: '9369.20',
        GxUsdExchangeRate: GX_USD_CONV.toFixed(2),
      });
    });

    it('Case 35', async function () {
      expect(
        computeG1ToGxConversion(120000000, 120000000, 180, 10),
      ).to.deep.equal({
        m1: '0.2000',
        m2: '0.4000',
        m3: '0.3000',
        m4: '0.0000',
        m5: '0.2500',
        m6: '1.0000',
        finalG1Usd: '0.005000',
        gxFromUsd: '5000.00',
        usdFromG1: '600000.00',
        gxFromG1: '16666666.67',
        gxReceived: '16671666.67',
        equivalentUsdInvested: '600180.00',
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
