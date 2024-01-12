import chai, { expect } from 'chai';
import {
  mockUserName,
  mockUserHandle,
  getCollectionUsersMock,
  mockUserHandle1,
  mockUserName1,
  mockUserHandle2,
  mockUserName2,
  getCollectionRewardsMock,
  mockUserTelegramID,
  mockTransactionHash,
  mockResponsePath,
  mockUserTelegramID1,
  mockWallet,
  mockWallet1,
  mockResponsePath1,
  mockTransactionHash1,
  mockUserTelegramID2,
  mockResponsePath2,
  mockWallet2,
} from '../utils';
import chaiExclude from 'chai-exclude';
import { UserTelegram } from '../../utils/user';
import { RewardReason } from '../../utils/constants';

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
        {
          userTelegramID: '846343721',
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

      it('Should return the MVU score rounded as undefined if not available', async function () {
        const user = await UserTelegram.build('846343721');
        expect(user.getMvuRounded()).to.be.undefined;
      });

      it('Should return the MVU score rounded as a number available', async function () {
        const user = await UserTelegram.build('846343728');
        expect(user.getMvuRounded()).to.equal(7);
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

    describe('Rewards', async function () {
      beforeEach(async function () {
        const collectionRewardsMock = await getCollectionRewardsMock();

        await collectionRewardsMock?.insertMany([
          {
            userTelegramID: mockUserTelegramID,
            responsePath: mockResponsePath,
            walletAddress: mockWallet,
            reason: RewardReason.SIGNUP,
            userHandle: mockUserHandle,
            userName: mockUserName,
            amount: '100',
            message: 'Sign up reward',
            transactionHash: mockTransactionHash,
            status: 'success',
          },
          {
            userTelegramID: mockUserTelegramID1,
            responsePath: mockResponsePath1,
            walletAddress: mockWallet1,
            reason: RewardReason.SIGNUP,
            userHandle: mockUserHandle1,
            userName: mockUserName1,
            amount: '100',
            message: 'Sign up reward',
            transactionHash: mockTransactionHash1,
            status: 'success',
          },
          {
            userTelegramID: mockUserTelegramID,
            responsePath: mockResponsePath,
            walletAddress: mockWallet,
            reason: RewardReason.REFERRAL,
            userHandle: mockUserHandle,
            userName: mockUserName,
            amount: '50',
            message: 'Referral reward',
            transactionHash:
              '0x33710bb0f77f18416efed68b6e8aea9914a63e04adc7e46f666b069cec775ad1',
            parentTransactionHash:
              '0xe89fdb28a0e562963c035db0bb6f65fc4b5efab30d6aad50b123e59675a0748c',
            status: 'success',
          },
          {
            userTelegramID: mockUserTelegramID,
            responsePath: mockResponsePath,
            walletAddress: mockWallet,
            reason: RewardReason.REFERRAL,
            userHandle: mockUserHandle,
            userName: mockUserName,
            amount: '50',
            message: 'Referral reward',
            transactionHash:
              '0x33710bb0f77f1841ghtjtjefed68b6e8aea9914a63e04adc7e46f666b069cec775ad1',
            parentTransactionHash:
              '0xe89fdb28a0e562963c035db0bb6f65fc4b5efab30d6aad50b12gjthjt59675a0748c',
            status: 'success',
          },
          {
            userTelegramID: mockUserTelegramID,
            responsePath: mockResponsePath,
            walletAddress: mockWallet,
            reason: RewardReason.REFERRAL,
            userHandle: mockUserHandle,
            userName: mockUserName,
            amount: '50',
            message: 'Referral reward',
            transactionHash:
              '0x33710bb0f77frt41ghtjtjefed68b6e8aea9914a63e04adc7e46f666b069cec775ad1',
            parentTransactionHash:
              '0xe89ffhgh28a0e562963c035db0bb6f65fc4b5efab30d6aad50b12gjthjt59675a0748c',
            status: 'success',
          },
          {
            userTelegramID: '11491856',
            responsePath: '64d170d6f6/c/114946',
            walletAddress: '0xcc69221713609dA5eF5CAa7',
            reason: RewardReason.REFERRAL,
            userHandle: 'Kadkjdjfg',
            userName: 'gfgfg fjfjhc',
            amount: '50',
            message: 'Referral reward',
            transactionHash:
              '0xa527544742dc2a330bc7de7da2574241af7929acd687296ghghb1579bfed4d262a',
            parentTransactionHash:
              '0x0068dc7ad567fac23d74111a526bbeffc46a8867ghtyut41cb7e5b77187faf0ded1a0',
            status: 'success',
          },
          {
            userTelegramID: mockUserTelegramID2,
            responsePath: mockResponsePath2,
            walletAddress: mockWallet2,
            reason: RewardReason.LINK,
            userHandle: mockUserHandle2,
            userName: mockUserName2,
            amount: '10',
            message: 'Referral link',
            transactionHash:
              '0x9a93ddc7ed2b8e609ede7e4f698867bc4b0ba2c6bb9731348636f550f7b8c9c3',
            sponsoredUserTelegramID: '1618212199',
            status: 'success',
          },
          {
            userTelegramID: mockUserTelegramID2,
            responsePath: mockResponsePath2,
            walletAddress: mockWallet2,
            reason: RewardReason.LINK,
            userHandle: mockUserHandle2,
            userName: mockUserName2,
            amount: '10',
            message: 'Referral link',
            transactionHash:
              '0xf8c83a9a8b4e0f0f947f95d91d9fa40e12c3b10e00269b15f2f10c76392c7b23',
            sponsoredUserTelegramID: '6012890355',
            status: 'success',
          },
        ]);
      });

      it('getLinkRewards should return an array of link rewards', async function () {
        const user = await UserTelegram.build(mockUserTelegramID2);
        expect(await user.getLinkRewards())
          .excluding(['_id'])
          .to.deep.equal([
            {
              userTelegramID: mockUserTelegramID2,
              responsePath: mockResponsePath2,
              walletAddress: mockWallet2,
              reason: RewardReason.LINK,
              userHandle: mockUserHandle2,
              userName: mockUserName2,
              amount: '10',
              message: 'Referral link',
              transactionHash:
                '0x9a93ddc7ed2b8e609ede7e4f698867bc4b0ba2c6bb9731348636f550f7b8c9c3',
              sponsoredUserTelegramID: '1618212199',
              status: 'success',
            },
            {
              userTelegramID: mockUserTelegramID2,
              responsePath: mockResponsePath2,
              walletAddress: mockWallet2,
              reason: RewardReason.LINK,
              userHandle: mockUserHandle2,
              userName: mockUserName2,
              amount: '10',
              message: 'Referral link',
              transactionHash:
                '0xf8c83a9a8b4e0f0f947f95d91d9fa40e12c3b10e00269b15f2f10c76392c7b23',
              sponsoredUserTelegramID: '6012890355',
              status: 'success',
            },
          ]);
      });

      it('getLinkRewards should return an empty array if no link reward', async function () {
        const user = await UserTelegram.build('11491856');
        expect(await user.getLinkRewards()).to.be.empty;
      });

      it('getLinkRewards should return an empty array if user is not in database', async function () {
        const user = await UserTelegram.build('not_in_db');
        expect(await user.getLinkRewards()).to.be.empty;
      });

      it('getSignUpReward should return an array of sign up rewards', async function () {
        const user = await UserTelegram.build(mockUserTelegramID);
        expect(await user.getSignUpReward())
          .excluding(['_id'])
          .to.deep.equal([
            {
              userTelegramID: mockUserTelegramID,
              responsePath: mockResponsePath,
              walletAddress: mockWallet,
              reason: RewardReason.SIGNUP,
              userHandle: mockUserHandle,
              userName: mockUserName,
              amount: '100',
              message: 'Sign up reward',
              transactionHash: mockTransactionHash,
              status: 'success',
            },
          ]);
      });

      it('getSignUpReward should return an empty array if no sign up reward', async function () {
        const user = await UserTelegram.build('11491856');
        expect(await user.getSignUpReward()).to.be.empty;
      });

      it('getSignUpReward should return an empty array if user is not in database', async function () {
        const user = await UserTelegram.build('not_in_db');
        expect(await user.getSignUpReward()).to.be.empty;
      });

      it('hasSignUpReward should return true if user has a sign up reward', async function () {
        const user = await UserTelegram.build(mockUserTelegramID);
        expect(await user.hasSignUpReward()).to.be.true;
      });

      it('hasSignUpReward should return false if user has no sign up reward', async function () {
        const user = await UserTelegram.build('11491856');
        expect(await user.hasSignUpReward()).to.be.false;
      });

      it('hasSignUpReward should return false if user is not in database', async function () {
        const user = await UserTelegram.build('not_in_db');
        expect(await user.hasSignUpReward()).to.be.false;
      });

      it('getReferralRewards should return an array of referral rewards', async function () {
        const user = await UserTelegram.build(mockUserTelegramID);
        expect(await user.getReferralRewards())
          .excluding(['_id'])
          .to.deep.equal([
            {
              userTelegramID: mockUserTelegramID,
              responsePath: mockResponsePath,
              walletAddress: mockWallet,
              reason: RewardReason.REFERRAL,
              userHandle: mockUserHandle,
              userName: mockUserName,
              amount: '50',
              message: 'Referral reward',
              transactionHash:
                '0x33710bb0f77f18416efed68b6e8aea9914a63e04adc7e46f666b069cec775ad1',
              parentTransactionHash:
                '0xe89fdb28a0e562963c035db0bb6f65fc4b5efab30d6aad50b123e59675a0748c',
              status: 'success',
            },
            {
              userTelegramID: mockUserTelegramID,
              responsePath: mockResponsePath,
              walletAddress: mockWallet,
              reason: RewardReason.REFERRAL,
              userHandle: mockUserHandle,
              userName: mockUserName,
              amount: '50',
              message: 'Referral reward',
              transactionHash:
                '0x33710bb0f77f1841ghtjtjefed68b6e8aea9914a63e04adc7e46f666b069cec775ad1',
              parentTransactionHash:
                '0xe89fdb28a0e562963c035db0bb6f65fc4b5efab30d6aad50b12gjthjt59675a0748c',
              status: 'success',
            },
            {
              userTelegramID: mockUserTelegramID,
              responsePath: mockResponsePath,
              walletAddress: mockWallet,
              reason: RewardReason.REFERRAL,
              userHandle: mockUserHandle,
              userName: mockUserName,
              amount: '50',
              message: 'Referral reward',
              transactionHash:
                '0x33710bb0f77frt41ghtjtjefed68b6e8aea9914a63e04adc7e46f666b069cec775ad1',
              parentTransactionHash:
                '0xe89ffhgh28a0e562963c035db0bb6f65fc4b5efab30d6aad50b12gjthjt59675a0748c',
              status: 'success',
            },
          ]);
      });

      it('getReferralRewards should return an empty array if no referral reward', async function () {
        const user = await UserTelegram.build(mockUserTelegramID1);
        expect(await user.getReferralRewards()).to.be.empty;
      });

      it('getReferralRewards should return an empty array if user is not in database', async function () {
        const user = await UserTelegram.build('not_in_db');
        expect(await user.getReferralRewards()).to.be.empty;
      });

      it('getNbrReferralRewards should return the number of referral rewards', async function () {
        const user = await UserTelegram.build(mockUserTelegramID);
        expect(await user.getNbrReferralRewards()).to.equal(3);
      });

      it('getNbrReferralRewards should return 0 if no referral reward', async function () {
        const user = await UserTelegram.build(mockUserTelegramID1);
        expect(await user.getNbrReferralRewards()).to.equal(0);
      });

      it('getNbrReferralRewards should return 0 if user not in database', async function () {
        const user = await UserTelegram.build('not_in_db');
        expect(await user.getNbrReferralRewards()).to.equal(0);
      });

      it('getNbrLinkRewards should return the number of link rewards', async function () {
        const user = await UserTelegram.build(mockUserTelegramID2);
        expect(await user.getNbrLinkRewards()).to.equal(2);
      });

      it('getNbrLinkRewards should return 0 if no link reward', async function () {
        const user = await UserTelegram.build(mockUserTelegramID1);
        expect(await user.getNbrLinkRewards()).to.equal(0);
      });

      it('getNbrLinkRewards should return 0 if user not in database', async function () {
        const user = await UserTelegram.build('not_in_db');
        expect(await user.getNbrLinkRewards()).to.equal(0);
      });
    });
  });
});
