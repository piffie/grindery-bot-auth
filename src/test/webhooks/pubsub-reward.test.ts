import chai, { expect } from 'chai';
import {
  mockResponsePath,
  mockUserHandle,
  mockUserName,
  mockUserTelegramID,
  mockWallet,
  mockUserTelegramID1,
  getCollectionUsersMock,
  mockEventId,
} from '../utils';
import { handleNewReward } from '../../webhooks/webhook';
import Sinon from 'sinon';
import axios from 'axios';

import chaiExclude from 'chai-exclude';
import { signup_utils } from '../../webhooks/signup-reward';
import { referral_utils } from '../../webhooks/referral-reward';
import { link_reward_utils } from '../../webhooks/link-reward';
import * as web3 from '../../utils/web3';
import { NewUserParams } from '../../types/webhook.types';
import {
  PATCHWALLET_RESOLVER_URL,
  SEGMENT_IDENTITY_URL,
} from '../../utils/constants';
import { ContractStub, RewardStub } from '../../types/tests.types';

chai.use(chaiExclude);

describe('handleReferralReward function', function () {
  let sandbox: Sinon.SinonSandbox;
  let axiosStub;
  let signUpRewardStub: Sinon.SinonStub<
    [params: NewUserParams],
    Promise<boolean>
  >;
  let referralRewardStub: Sinon.SinonStub<
    [params: NewUserParams],
    Promise<boolean>
  >;
  let linkRewardStub: Sinon.SinonStub<
    [params: NewUserParams],
    Promise<boolean>
  >;
  let collectionUsersMock;
  let contractStub: ContractStub;
  let getContract;

  beforeEach(async function () {
    collectionUsersMock = await getCollectionUsersMock();

    sandbox = Sinon.createSandbox();
    axiosStub = sandbox.stub(axios, 'post').callsFake(async (url: string) => {
      if (url === PATCHWALLET_RESOLVER_URL) {
        return Promise.resolve({
          data: {
            users: [{ accountAddress: mockWallet }],
          },
        });
      }

      if (url === SEGMENT_IDENTITY_URL) {
        return Promise.resolve({
          result: 'success',
        });
      }

      throw new Error('Unexpected URL encountered');
    });
    signUpRewardStub = sandbox
      .stub(signup_utils, 'handleSignUpReward')
      .resolves(true);
    linkRewardStub = sandbox
      .stub(link_reward_utils, 'handleLinkReward')
      .resolves(true);
    referralRewardStub = sandbox
      .stub(referral_utils, 'handleReferralReward')
      .resolves(true);

    contractStub = {
      methods: {
        decimals: sandbox.stub().resolves('18'),
        transfer: sandbox.stub().callsFake((recipient, amount) => {
          return {
            encodeABI: sandbox.stub().returns(`${recipient}+${amount}`),
          };
        }),
      },
    };
    contractStub.methods.decimals = sandbox.stub().returns({
      call: sandbox.stub().resolves('18'),
    });
    getContract = () => {
      return contractStub;
    };
    sandbox.stub(web3, 'getContract').callsFake(getContract);
  });

  afterEach(function () {
    sandbox.restore();
  });

  it('Should not call handleSignUpReward if isSignupReward is false', async function () {
    await handleNewReward({
      isSignupReward: false,
      isReferralReward: true,
      isLinkReward: true,
      eventId: mockEventId,
      userTelegramID: mockUserTelegramID,
      responsePath: mockResponsePath,
      userHandle: mockUserHandle,
      userName: mockUserName,
    });

    expect(signUpRewardStub.getCalls()).to.be.empty;
  });

  it('Should not call handleReferralReward if isReferralReward is false', async function () {
    await handleNewReward({
      isSignupReward: true,
      isReferralReward: false,
      isLinkReward: true,
      eventId: mockEventId,
      userTelegramID: mockUserTelegramID,
      responsePath: mockResponsePath,
      userHandle: mockUserHandle,
      userName: mockUserName,
    });

    expect(referralRewardStub.getCalls()).to.be.empty;
  });

  it('Should not call handleLinkReward if isLinkReward is false', async function () {
    await handleNewReward({
      isSignupReward: true,
      isReferralReward: true,
      isLinkReward: false,
      eventId: mockEventId,
      userTelegramID: mockUserTelegramID,
      responsePath: mockResponsePath,
      userHandle: mockUserHandle,
      userName: mockUserName,
    });

    expect(linkRewardStub.getCalls()).to.be.empty;
  });

  it('Should return true with no new user if user is not new', async function () {
    await collectionUsersMock.insertOne({
      userTelegramID: mockUserTelegramID,
    });

    const result = await handleNewReward({
      isSignupReward: true,
      isReferralReward: true,
      isLinkReward: true,
      eventId: mockEventId,
      userTelegramID: mockUserTelegramID,
      responsePath: mockResponsePath,
      userHandle: mockUserHandle,
      userName: mockUserName,
    });

    expect(result).to.be.true;
    expect(await collectionUsersMock.find({}).toArray())
      .excluding(['_id'])
      .to.deep.equal([
        {
          userTelegramID: mockUserTelegramID,
        },
      ]);
  });

  it('Should return true if user is new', async function () {
    const result = await handleNewReward({
      isSignupReward: true,
      isReferralReward: true,
      isLinkReward: true,
      eventId: mockEventId,
      userTelegramID: mockUserTelegramID,
      responsePath: mockResponsePath,
      userHandle: mockUserHandle,
      userName: mockUserName,
    });

    expect(result).to.be.true;
  });

  it('Should return false with no new user if signup reward is false', async function () {
    (signup_utils.handleSignUpReward as RewardStub).resolves(false);

    const result = await handleNewReward({
      isSignupReward: true,
      isReferralReward: true,
      isLinkReward: true,
      eventId: mockEventId,
      userTelegramID: mockUserTelegramID,
      responsePath: mockResponsePath,
      userHandle: mockUserHandle,
      userName: mockUserName,
    });

    expect(result).to.be.false;
    expect(await collectionUsersMock.find({}).toArray()).to.be.empty;
  });

  it('Should return true and populate database properly after restart', async function () {
    (signup_utils.handleSignUpReward as RewardStub).resolves(false);

    let result = await handleNewReward({
      isSignupReward: true,
      isReferralReward: true,
      isLinkReward: true,
      eventId: mockEventId,
      userTelegramID: mockUserTelegramID,
      responsePath: mockResponsePath,
      userHandle: mockUserHandle,
      userName: mockUserName,
    });

    expect(result).to.be.false;

    (signup_utils.handleSignUpReward as RewardStub).resolves(true);

    // Restart
    result = await handleNewReward({
      isSignupReward: true,
      isReferralReward: true,
      isLinkReward: true,
      eventId: mockEventId,
      userTelegramID: mockUserTelegramID,
      responsePath: mockResponsePath,
      userHandle: mockUserHandle,
      userName: mockUserName,
    });

    const users = await collectionUsersMock.find({}).toArray();

    expect(result).to.be.true;
    expect(users)
      .excluding(['_id', 'dateAdded'])
      .to.deep.equal([
        {
          userTelegramID: mockUserTelegramID,
          userHandle: mockUserHandle,
          userName: mockUserName,
          responsePath: mockResponsePath,
          patchwallet: mockWallet,
        },
      ]);
  });

  it('Should return false and no new user if referral reward is false', async function () {
    (referral_utils.handleReferralReward as RewardStub).resolves(false);

    expect(
      await handleNewReward({
        isSignupReward: true,
        isReferralReward: true,
        isLinkReward: true,
        eventId: mockEventId,
        userTelegramID: mockUserTelegramID,
        responsePath: mockResponsePath,
        userHandle: mockUserHandle,
        userName: mockUserName,
      }),
    ).to.be.false;
    expect(await collectionUsersMock.find({}).toArray()).to.be.empty;
  });

  it('Should be able to restart, return true and populate the database properly after restart', async function () {
    (referral_utils.handleReferralReward as RewardStub).resolves(false);

    let result = await handleNewReward({
      isSignupReward: true,
      isReferralReward: true,
      isLinkReward: true,
      eventId: mockEventId,
      userTelegramID: mockUserTelegramID,
      responsePath: mockResponsePath,
      userHandle: mockUserHandle,
      userName: mockUserName,
    });

    expect(result).to.be.false;
    expect(await collectionUsersMock.find({}).toArray()).to.be.empty;

    (referral_utils.handleReferralReward as RewardStub).resolves(true);

    result = await handleNewReward({
      isSignupReward: true,
      isReferralReward: true,
      isLinkReward: true,
      eventId: mockEventId,
      userTelegramID: mockUserTelegramID,
      responsePath: mockResponsePath,
      userHandle: mockUserHandle,
      userName: mockUserName,
    });

    expect(result).to.be.true;
    expect(await collectionUsersMock.find({}).toArray())
      .excluding(['_id', 'dateAdded'])
      .to.deep.equal([
        {
          userTelegramID: mockUserTelegramID,
          userHandle: mockUserHandle,
          userName: mockUserName,
          responsePath: mockResponsePath,
          patchwallet: mockWallet,
        },
      ]);
  });

  it('Should return true and populate database correctly with referral link', async function () {
    const result = await handleNewReward({
      isSignupReward: true,
      isReferralReward: true,
      isLinkReward: true,
      eventId: mockEventId,
      userTelegramID: mockUserTelegramID,
      responsePath: mockResponsePath,
      userHandle: mockUserHandle,
      userName: mockUserName,
      referentUserTelegramID: mockUserTelegramID1,
    });

    expect(result).to.be.true;
    expect(await collectionUsersMock.find({}).toArray())
      .excluding(['_id', 'dateAdded'])
      .to.deep.equal([
        {
          userTelegramID: mockUserTelegramID,
          userHandle: mockUserHandle,
          userName: mockUserName,
          responsePath: mockResponsePath,
          patchwallet: mockWallet,
        },
      ]);
  });

  it('Should be able to restart and return true + populate the database properly', async function () {
    (link_reward_utils.handleLinkReward as RewardStub).resolves(false);

    let result = await handleNewReward({
      isSignupReward: true,
      isReferralReward: true,
      isLinkReward: true,
      eventId: mockEventId,
      userTelegramID: mockUserTelegramID,
      responsePath: mockResponsePath,
      userHandle: mockUserHandle,
      userName: mockUserName,
      referentUserTelegramID: mockUserTelegramID1,
    });

    expect(result).to.be.false;
    expect(await collectionUsersMock.find({}).toArray()).to.be.empty;

    (link_reward_utils.handleLinkReward as RewardStub).resolves(true);

    result = await handleNewReward({
      isSignupReward: true,
      isReferralReward: true,
      isLinkReward: true,
      eventId: mockEventId,
      userTelegramID: mockUserTelegramID,
      responsePath: mockResponsePath,
      userHandle: mockUserHandle,
      userName: mockUserName,
      referentUserTelegramID: mockUserTelegramID1,
    });

    expect(result).to.be.true;
    expect(await collectionUsersMock.find({}).toArray())
      .excluding(['_id', 'dateAdded'])
      .to.deep.equal([
        {
          userTelegramID: mockUserTelegramID,
          userHandle: mockUserHandle,
          userName: mockUserName,
          responsePath: mockResponsePath,
          patchwallet: mockWallet,
        },
      ]);
  });

  it('Should populate the segment user properly', async function () {
    await handleNewReward({
      isSignupReward: true,
      isReferralReward: true,
      isLinkReward: true,
      eventId: mockEventId,
      userTelegramID: 'newUserTgId',
      responsePath: mockResponsePath,
      userHandle: mockUserHandle,
      userName: mockUserName,
    });

    const segmentIdentityCall = axiosStub
      .getCalls()
      .filter((e) => e.firstArg === SEGMENT_IDENTITY_URL);

    expect(segmentIdentityCall[0].args[1])
      .excluding(['timestamp'])
      .to.deep.equal({
        userId: 'newUserTgId',
        traits: {
          responsePath: mockResponsePath,
          userHandle: mockUserHandle,
          userName: mockUserName,
          patchwallet: mockWallet,
        },
      });
    expect(segmentIdentityCall[0].args[1].timestamp).to.be.greaterThanOrEqual(
      new Date(Date.now() - 20000),
    ); // 20 seconds
    expect(segmentIdentityCall[0].args[1].timestamp).to.be.lessThanOrEqual(
      new Date(),
    );
  });

  it('Should return false with nothing in the database if PatchWallet address error', async function () {
    axiosStub
      .withArgs(PATCHWALLET_RESOLVER_URL)
      .rejects(new Error('Service not available'));

    const result = await handleNewReward({
      isSignupReward: true,
      isReferralReward: true,
      isLinkReward: true,
      eventId: mockEventId,
      userTelegramID: mockUserTelegramID,
      responsePath: mockResponsePath,
      userHandle: mockUserHandle,
      userName: mockUserName,
      referentUserTelegramID: mockUserTelegramID1,
    });

    expect(result).to.be.false;
    expect(await collectionUsersMock.find({}).toArray()).to.be.empty;
  });

  it('Should return true if error in Segment', async function () {
    axiosStub
      .withArgs(SEGMENT_IDENTITY_URL)
      .rejects(new Error('Service not available'));

    const result = await handleNewReward({
      isSignupReward: true,
      isReferralReward: true,
      isLinkReward: true,
      eventId: mockEventId,
      userTelegramID: mockUserTelegramID,
      responsePath: mockResponsePath,
      userHandle: mockUserHandle,
      userName: mockUserName,
      referentUserTelegramID: mockUserTelegramID1,
    });

    expect(result).to.be.true;
  });
});
