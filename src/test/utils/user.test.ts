import chai, { expect } from 'chai';
import {
  mockUserName,
  mockUserHandle,
  getCollectionUsersMock,
  mockUserHandle1,
  mockUserName1,
  mockUserHandle2,
  mockUserName2,
} from '../utils';
import chaiExclude from 'chai-exclude';
import { UserTelegram } from '../../utils/user';

chai.use(chaiExclude);

describe('User utils', async function () {
  describe('UserTelegram class', async function () {
    let collectionUsersMock;

    beforeEach(async function () {
      collectionUsersMock = await getCollectionUsersMock();

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
            balance_100123: '110581',
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
          userTelegramID: '846343728',
          patchwallet: '0xAe29C9fD46648E0831b21E67dccE6B117664ec06',
          responsePath: '64d170d6dc5a2a00578ad6f6/c/846343728',
          userHandle: mockUserHandle1,
          userName: mockUserName1,
          attributes: {
            aff_score: null,
            balance_100123: '110581',
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
          },
        },
        {
          userTelegramID: '846343729',
          patchwallet: '0x2329C9fD46648E0831b21E67dccE6B117664ec06',
          responsePath: '64d170d6dc5a2a00578ad6f6/c/846343728',
          userHandle: mockUserHandle2,
          userName: mockUserName2,
          attributes: {
            aff_score: null,
            balance_100123: '110581',
            host_score: '3',
            isActiveUser: true,
            isBlacklist: false,
            isContributeUser: true,
            isDead: true,
            isDoubleSpent: true,
            isDrone: true,
            isDroneOwner: true,
            isGamer: true,
            isSlave: true,
            isWalkingDead: true,
            mvu_rounded: '7',
            virtual_balance: '30000',
          },
        },
      ]);
    });

    describe('Basic properties', async function () {
      it('getUserFromDatabase should return the full user as an object', async function () {
        const user = await UserTelegram.build('846343729');
        expect(await user.getUserFromDatabase())
          .excluding(['_id'])
          .to.deep.equal({
            userTelegramID: '846343729',
            patchwallet: '0x2329C9fD46648E0831b21E67dccE6B117664ec06',
            responsePath: '64d170d6dc5a2a00578ad6f6/c/846343728',
            userHandle: mockUserHandle2,
            userName: mockUserName2,
            attributes: {
              aff_score: null,
              balance_100123: '110581',
              host_score: '3',
              isActiveUser: true,
              isBlacklist: false,
              isContributeUser: true,
              isDead: true,
              isDoubleSpent: true,
              isDrone: true,
              isDroneOwner: true,
              isGamer: true,
              isSlave: true,
              isWalkingDead: true,
              mvu_rounded: '7',
              virtual_balance: '30000',
            },
          });
      });

      it('getUserFromDatabase should return null if user is not in database', async function () {
        const user = await UserTelegram.build('846343722');
        expect(await user.getUserFromDatabase()).to.be.null;
      });

      it('isUserInDatabase should return true if user is in database', async function () {
        const user = await UserTelegram.build('846343729');
        expect(await user.isUserInDatabase()).to.be.true;
      });

      it('isUserInDatabase should return false if user is not in database', async function () {
        const user = await UserTelegram.build('846343722');
        expect(await user.isUserInDatabase()).to.be.false;
      });

      it('Should have the proper user Telegram ID', async function () {
        const user = await UserTelegram.build('846343729');
        expect(user.userTelegramID).to.equal('846343729');
      });

      it('Should give the proper user handle', async function () {
        const user = await UserTelegram.build('846343729');
        expect(user.userHandle()).to.equal(mockUserHandle2);
      });

      it('Should return the user name', async function () {
        const user = await UserTelegram.build('846343729');
        expect(user.userName()).to.equal(mockUserName2);
      });

      it('Should return the patchwallet address', async function () {
        const user = await UserTelegram.build('846343729');
        expect(user.patchwalletAddress()).to.equal(
          '0x2329C9fD46648E0831b21E67dccE6B117664ec06',
        );
      });

      it('Should return the response path', async function () {
        const user = await UserTelegram.build('846343729');
        expect(user.responsePath()).to.equal(
          '64d170d6dc5a2a00578ad6f6/c/846343728',
        );
      });

      it('Should return the user Telegram ID', async function () {
        const user = await UserTelegram.build('846343729');
        expect(user.getUserTelegramID()).to.equal('846343729');
      });

      it('Should return the user attributes as undefined if not available', async function () {
        const user = await UserTelegram.build('5958052954');
        expect(user.attributes()).to.be.undefined;
      });

      it('Should return the user attributes', async function () {
        const user = await UserTelegram.build('846343729');
        expect(user.attributes()).to.deep.equal({
          aff_score: null,
          balance_100123: '110581',
          host_score: '3',
          isActiveUser: true,
          isBlacklist: false,
          isContributeUser: true,
          isDead: true,
          isDoubleSpent: true,
          isDrone: true,
          isDroneOwner: true,
          isGamer: true,
          isSlave: true,
          isWalkingDead: true,
          mvu_rounded: '7',
          virtual_balance: '30000',
        });
      });

      it('Should return the MVU score as undefined if not available', async function () {
        const user = await UserTelegram.build('846343729');
        expect(user.getMvu()).to.be.undefined;
      });

      it('Should return the MVU score as a number available', async function () {
        const user = await UserTelegram.build('846343728');
        expect(user.getMvu()).to.equal(7.35);
      });

      it('Should return the virtual balance as a number', async function () {
        const user = await UserTelegram.build('846343729');
        expect(user.getVirtualBalance()).to.equal(30000);
      });

      it('Should return the virtual balance as undefined if not available', async function () {
        const user = await UserTelegram.build('846343728');
        expect(user.getVirtualBalance()).to.be.undefined;
      });

      it('Should return true for isActiveUser when the attribute is true', async function () {
        const user = await UserTelegram.build('846343729');
        expect(user.isActiveUser()).to.be.true;
      });

      it('Should return false for isBlacklist when the attribute is false', async function () {
        const user = await UserTelegram.build('846343729');
        expect(user.isBlacklist()).to.be.false;
      });

      it('Should return true for isContributeUser when the attribute is true', async function () {
        const user = await UserTelegram.build('846343729');
        expect(user.isContributeUser()).to.be.true;
      });

      it('Should return true for isDead when the attribute is true', async function () {
        const user = await UserTelegram.build('846343729');
        expect(user.isDead()).to.be.true;
      });

      it('Should return false for isDoubleSpent when the attribute is false', async function () {
        const user = await UserTelegram.build('846343729');
        expect(user.isDoubleSpent()).to.be.true;
      });

      it('Should return true for isDrone when the attribute is true', async function () {
        const user = await UserTelegram.build('846343729');
        expect(user.isDrone()).to.be.true;
      });

      it('Should return true for isDroneOwner when the attribute is true', async function () {
        const user = await UserTelegram.build('846343729');
        expect(user.isDroneOwner()).to.be.true;
      });

      it('Should return true for isGamer when the attribute is true', async function () {
        const user = await UserTelegram.build('846343729');
        expect(user.isGamer()).to.be.true;
      });

      it('Should return true for isSlave when the attribute is true', async function () {
        const user = await UserTelegram.build('846343729');
        expect(user.isSlave()).to.be.true;
      });

      it('Should return true for isWalkingDead when the attribute is true', async function () {
        const user = await UserTelegram.build('846343729');
        expect(user.isWalkingDead()).to.be.true;
      });

      it('Should return undefined for isActiveUser when the attribute does not exist', async function () {
        const user = await UserTelegram.build('5958052954');
        expect(user.isActiveUser()).to.be.undefined;
      });

      it('Should return undefined for isBlacklist when the attribute does not exist', async function () {
        const user = await UserTelegram.build('5958052954');
        expect(user.isBlacklist()).to.be.undefined;
      });

      it('Should return undefined for isContributeUser when the attribute does not exist', async function () {
        const user = await UserTelegram.build('5958052954');
        expect(user.isContributeUser()).to.be.undefined;
      });

      it('Should return undefined for isDead when the attribute does not exist', async function () {
        const user = await UserTelegram.build('5958052954');
        expect(user.isDead()).to.be.undefined;
      });

      it('Should return undefined for isDoubleSpent when the attribute does not exist', async function () {
        const user = await UserTelegram.build('5958052954');
        expect(user.isDoubleSpent()).to.be.undefined;
      });

      it('Should return undefined for isDrone when the attribute does not exist', async function () {
        const user = await UserTelegram.build('5958052954');
        expect(user.isDrone()).to.be.undefined;
      });

      it('Should return undefined for isDroneOwner when the attribute does not exist', async function () {
        const user = await UserTelegram.build('5958052954');
        expect(user.isDroneOwner()).to.be.undefined;
      });

      it('Should return undefined for isGamer when the attribute does not exist', async function () {
        const user = await UserTelegram.build('5958052954');
        expect(user.isGamer()).to.be.undefined;
      });

      it('Should return undefined for isSlave when the attribute does not exist', async function () {
        const user = await UserTelegram.build('5958052954');
        expect(user.isSlave()).to.be.undefined;
      });

      it('Should return undefined for isWalkingDead when the attribute does not exist', async function () {
        const user = await UserTelegram.build('5958052954');
        expect(user.isWalkingDead()).to.be.undefined;
      });
    });
  });
});
