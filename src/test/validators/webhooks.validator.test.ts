import chai from 'chai';
import {
  isolatedRewardValidator,
  newRewardValidator,
  newTransactionBatchValidator,
  newTransactionValidator,
  swapValidator,
} from '../../validators/webhooks.validator';
import { validateResult } from '../../validators/utils';
import { mockTokenAddress, mockWallet, mockWallet1 } from '../utils';

const NUMBER_PARAMETER_TEST_SWAP = swapValidator.length - 1;
const NUMBER_PARAMETER_TEST_TX = newTransactionValidator.length - 1;
const NUMBER_PARAMETER_TEST_TX_BATCH = newTransactionBatchValidator.length - 2;
const NUMBER_PARAMETER_TEST_REWARD = newRewardValidator.length - 1;
const NUMBER_PARAMETER_TEST_ISOLATED_REWARD =
  isolatedRewardValidator.length - 1;

describe('Webhook validators', function () {
  describe('New Reward Validator', function () {
    const validParams = {
      event: 'new_reward',
      params: {
        userTelegramID: '12345',
        responsePath: '/path',
        userHandle: 'handle123',
        userName: 'JohnDoe',
        isSignupReward: true,
        isReferralReward: false,
        isLinkReward: true,
        delegatecall: '1',
        tokenAddress: mockTokenAddress,
        chainName: 'ETH',
        referentUserTelegramID: '67890',
      },
    };

    const invalidParams = {
      event: 'invalid_event',
      params: {
        userTelegramID: 12345,
        referentUserTelegramID: 12345,
        responsePath: 123,
        userHandle: true,
        userName: { name: 'JohnDoe' },
        isSignupReward: 'rue',
        isReferralReward: 'alse',
        isLinkReward: 'rue',
        delegatecall: 2,
        tokenAddress: 'invalid_address',
        chainName: 123,
      },
    };

    it('Should pass with valid params', async function () {
      const req = { body: validParams };
      await Promise.all(
        newRewardValidator.map((middleware) => middleware(req, {}, () => {})),
      );
      chai.expect(validateResult(req)).to.be.empty;
    });

    it('Should fail with invalid params', async function () {
      const req = { body: invalidParams };
      await Promise.all(
        newRewardValidator.map((middleware) => middleware(req, {}, () => {})),
      );

      chai
        .expect(validateResult(req).length)
        .to.equal(NUMBER_PARAMETER_TEST_REWARD);

      chai.expect(validateResult(req)).to.deep.equal([
        {
          type: 'field',
          value: 'invalid_event',
          msg: 'Invalid event type',
          path: 'event',
          location: 'body',
        },
        {
          type: 'field',
          value: 12345,
          msg: 'userTelegramID must be a string',
          path: 'params.userTelegramID',
          location: 'body',
        },
        {
          type: 'field',
          value: 12345,
          msg: 'referentUserTelegramID must be a string',
          path: 'params.referentUserTelegramID',
          location: 'body',
        },
        {
          type: 'field',
          value: 'rue',
          msg: 'isSignupReward must be a boolean',
          path: 'params.isSignupReward',
          location: 'body',
        },
        {
          type: 'field',
          value: 'alse',
          msg: 'isReferralReward must be a boolean',
          path: 'params.isReferralReward',
          location: 'body',
        },
        {
          type: 'field',
          value: 'rue',
          msg: 'isLinkReward must be a boolean',
          path: 'params.isLinkReward',
          location: 'body',
        },
        {
          type: 'field',
          value: 2,
          msg: 'delegatecall must be either 0 or 1',
          path: 'params.delegatecall',
          location: 'body',
        },
        {
          type: 'field',
          value: 'invalid_address',
          msg: 'tokenAddress must be a valid address',
          path: 'params.tokenAddress',
          location: 'body',
        },
        {
          type: 'field',
          value: 123,
          msg: 'responsePath must be a string',
          path: 'params.responsePath',
          location: 'body',
        },
        {
          type: 'field',
          value: true,
          msg: 'userHandle must be a string',
          path: 'params.userHandle',
          location: 'body',
        },
        {
          type: 'field',
          value: { name: 'JohnDoe' },
          msg: 'userName must be a string',
          path: 'params.userName',
          location: 'body',
        },
        {
          type: 'field',
          value: 123,
          msg: 'chainName must be a string',
          path: 'params.chainName',
          location: 'body',
        },
      ]);
    });
  });

  describe('New Transaction Validator', function () {
    const validParams = {
      event: 'new_transaction',
      params: {
        senderTgId: '12345',
        recipientTgId: '67890',
        amount: '100',
        delegatecall: '1',
        tokenAddress: mockTokenAddress,
        chainName: 'ETH',
        message: 'Transaction message',
        tokenSymbol: 'TKN',
        chainId: 'eip155:59144',
      },
    };

    const invalidParams = {
      event: 'invalid_event',
      params: {
        senderTgId: 12345,
        recipientTgId: 67890,
        amount: '-10',
        delegatecall: 2,
        tokenAddress: '0x105E9152e3d4F5486f2953eF6578f7e25c27C3505',
        chainName: 123,
        message: 123,
        tokenSymbol: true,
        chainId: 'eip155:59143',
      },
    };

    it('Should pass with valid params', async function () {
      const req = { body: validParams };
      await Promise.all(
        newTransactionValidator.map((middleware) =>
          middleware(req, {}, () => {}),
        ),
      );
      chai.expect(validateResult(req)).to.be.empty;
    });

    it('Should fail with invalid params', async function () {
      const req = { body: invalidParams };
      await Promise.all(
        newTransactionValidator.map((middleware) =>
          middleware(req, {}, () => {}),
        ),
      );

      chai
        .expect(validateResult(req).length)
        .to.equal(NUMBER_PARAMETER_TEST_TX);

      chai.expect(validateResult(req)).to.deep.equal([
        {
          type: 'field',
          value: 'invalid_event',
          msg: 'Invalid event type',
          path: 'event',
          location: 'body',
        },
        {
          type: 'field',
          value: 12345,
          msg: 'senderTgId must be a string',
          path: 'params.senderTgId',
          location: 'body',
        },
        {
          type: 'field',
          value: 67890,
          msg: 'recipientTgId must be a string',
          path: 'params.recipientTgId',
          location: 'body',
        },
        {
          type: 'field',
          value: '-10',
          msg: 'Invalid amount',
          path: 'params.amount',
          location: 'body',
        },
        {
          type: 'field',
          value: 2,
          msg: 'delegatecall must be either 0 or 1',
          path: 'params.delegatecall',
          location: 'body',
        },
        {
          type: 'field',
          value: '0x105E9152e3d4F5486f2953eF6578f7e25c27C3505',
          msg: 'tokenAddress must be a valid address',
          path: 'params.tokenAddress',
          location: 'body',
        },
        {
          type: 'field',
          value: 'eip155:59143',
          msg: 'chainId must be a valid and supported chain ID',
          path: 'params.chainId',
          location: 'body',
        },
        {
          type: 'field',
          value: 123,
          msg: 'chainName must be a string',
          path: 'params.chainName',
          location: 'body',
        },
        {
          type: 'field',
          value: 123,
          msg: 'message must be a string',
          path: 'params.message',
          location: 'body',
        },
        {
          type: 'field',
          value: true,
          msg: 'tokenSymbol must be a string',
          path: 'params.tokenSymbol',
          location: 'body',
        },
      ]);
    });
  });

  describe('New Transaction Batch Validator', function () {
    const validParams = {
      event: 'new_transaction_batch',
      params: [
        {
          senderTgId: '12345',
          recipientTgId: '67890',
          amount: '100',
          delegatecall: '1',
          tokenAddress: mockTokenAddress,
          chainName: 'ETH',
          message: 'Transaction message',
          tokenSymbol: 'TKN',
          chainId: 'eip155:59144',
        },
      ],
    };

    const invalidParams = {
      event: 'invalid_event',
      params: [
        {
          senderTgId: 12345,
          recipientTgId: 67890,
          amount: '-10',
          delegatecall: 2,
          tokenAddress: '0x105E9152e3d4F5486f2953eF6578f7e25c27C3505',
          chainName: 123,
          message: 123,
          tokenSymbol: true,
          chainId: 'eip155:59143',
        },
      ],
    };

    it('Should pass with valid params', async function () {
      const req = { body: validParams };
      await Promise.all(
        newTransactionBatchValidator.map((middleware) =>
          middleware(req, {}, () => {}),
        ),
      );
      chai.expect(validateResult(req)).to.be.empty;
    });

    it('Should fail with invalid params', async function () {
      const req = { body: invalidParams };
      await Promise.all(
        newTransactionBatchValidator.map((middleware) =>
          middleware(req, {}, () => {}),
        ),
      );

      chai
        .expect(validateResult(req).length)
        .to.equal(NUMBER_PARAMETER_TEST_TX_BATCH);

      chai.expect(validateResult(req)).to.deep.equal([
        {
          type: 'field',
          value: 'invalid_event',
          msg: 'Invalid event type',
          path: 'event',
          location: 'body',
        },
        {
          type: 'field',
          value: 12345,
          msg: 'senderTgId must be a string',
          path: 'params[0].senderTgId',
          location: 'body',
        },
        {
          type: 'field',
          value: 67890,
          msg: 'recipientTgId must be a string',
          path: 'params[0].recipientTgId',
          location: 'body',
        },
        {
          type: 'field',
          value: '-10',
          msg: 'Invalid amount',
          path: 'params[0].amount',
          location: 'body',
        },
        {
          type: 'field',
          value: 2,
          msg: 'delegatecall must be either 0 or 1',
          path: 'params[0].delegatecall',
          location: 'body',
        },
        {
          type: 'field',
          value: '0x105E9152e3d4F5486f2953eF6578f7e25c27C3505',
          msg: 'tokenAddress must be a valid address',
          path: 'params[0].tokenAddress',
          location: 'body',
        },
        {
          type: 'field',
          value: 'eip155:59143',
          msg: 'chainId must be a valid and supported chain ID',
          path: 'params[0].chainId',
          location: 'body',
        },
        {
          type: 'field',
          value: 123,
          msg: 'chainName must be a string',
          path: 'params[0].chainName',
          location: 'body',
        },
        {
          type: 'field',
          value: 123,
          msg: 'message must be a string',
          path: 'params[0].message',
          location: 'body',
        },
        {
          type: 'field',
          value: true,
          msg: 'tokenSymbol must be a string',
          path: 'params[0].tokenSymbol',
          location: 'body',
        },
      ]);
    });
  });

  describe('Swap Validator', function () {
    const validParams = {
      event: 'swap',
      params: {
        value: '100',
        userTelegramID: '12345',
        to: mockWallet,
        data: 'valid_data',
        tokenIn: mockTokenAddress,
        amountIn: '10',
        tokenOut: mockTokenAddress,
        amountOut: '20',
        priceImpact: '1.5',
        gas: '1000',
        from: mockWallet1,
        tokenInSymbol: 'TKN_IN',
        tokenOutSymbol: 'TKN_OUT',
        chainId: 'eip155:59144',
        chainName: 'ETH',
        amount: '50',
        senderTgId: '67890',
        delegatecall: 1,
      },
    };

    const invalidParams = {
      event: 'invalid_event',
      params: {
        value: 100,
        userTelegramID: 12345,
        to: '0x105E9152e3d4F5486f2953eF6578f7e25c27C3501',
        data: 123,
        tokenIn: '0x105E9152e3d4F5486f2953eF6578f7e25c27C3501',
        amountIn: '-10',
        tokenOut: '0x105E9152e3d4F5486f2953eF6578f7e25c27C3501',
        amountOut: '-20',
        priceImpact: 1.5,
        gas: 1000,
        from: '0x105E9152e3d4F5486f2953eF6578f7e25c27C3501',
        tokenInSymbol: true,
        tokenOutSymbol: 123,
        chainId: 12345,
        chainName: 123,
        amount: '-50',
        senderTgId: true,
        delegatecall: 2,
      },
    };

    it('Should pass with valid params', async function () {
      const req = { body: validParams };
      await Promise.all(
        swapValidator.map((middleware) => middleware(req, {}, () => {})),
      );
      chai.expect(validateResult(req)).to.be.empty;
    });

    it('Should fail with invalid params', async function () {
      const req = { body: invalidParams };
      await Promise.all(
        swapValidator.map((middleware) => middleware(req, {}, () => {})),
      );

      chai
        .expect(validateResult(req).length)
        .to.equal(NUMBER_PARAMETER_TEST_SWAP);

      chai.expect(validateResult(req)).to.deep.equal([
        {
          type: 'field',
          value: 'invalid_event',
          msg: 'Invalid event type',
          path: 'event',
          location: 'body',
        },
        {
          type: 'field',
          value: '0x105E9152e3d4F5486f2953eF6578f7e25c27C3501',
          msg: 'to must be a valid address',
          path: 'params.to',
          location: 'body',
        },
        {
          type: 'field',
          value: '0x105E9152e3d4F5486f2953eF6578f7e25c27C3501',
          msg: 'tokenIn must be a valid address',
          path: 'params.tokenIn',
          location: 'body',
        },
        {
          type: 'field',
          value: '-10',
          msg: 'Invalid amount',
          path: 'params.amountIn',
          location: 'body',
        },
        {
          type: 'field',
          value: '0x105E9152e3d4F5486f2953eF6578f7e25c27C3501',
          msg: 'tokenOut must be a valid address',
          path: 'params.tokenOut',
          location: 'body',
        },
        {
          type: 'field',
          value: '-20',
          msg: 'Invalid amount',
          path: 'params.amountOut',
          location: 'body',
        },
        {
          type: 'field',
          value: '0x105E9152e3d4F5486f2953eF6578f7e25c27C3501',
          msg: 'from must be a valid address',
          path: 'params.from',
          location: 'body',
        },
        {
          type: 'field',
          value: '-50',
          msg: 'Invalid amount',
          path: 'params.amount',
          location: 'body',
        },
        {
          type: 'field',
          value: 2,
          msg: 'delegatecall must be either 0 or 1',
          path: 'params.delegatecall',
          location: 'body',
        },
        {
          type: 'field',
          value: 100,
          msg: 'value must be a string',
          path: 'params.value',
          location: 'body',
        },
        {
          type: 'field',
          value: 12345,
          msg: 'userTelegramID must be a string',
          path: 'params.userTelegramID',
          location: 'body',
        },
        {
          type: 'field',
          value: 123,
          msg: 'data must be a string',
          path: 'params.data',
          location: 'body',
        },
        {
          type: 'field',
          value: 1.5,
          msg: 'priceImpact must be a string',
          path: 'params.priceImpact',
          location: 'body',
        },
        {
          type: 'field',
          value: 1000,
          msg: 'gas must be a string',
          path: 'params.gas',
          location: 'body',
        },
        {
          type: 'field',
          value: true,
          msg: 'tokenInSymbol must be a string',
          path: 'params.tokenInSymbol',
          location: 'body',
        },
        {
          type: 'field',
          value: 123,
          msg: 'tokenOutSymbol must be a string',
          path: 'params.tokenOutSymbol',
          location: 'body',
        },
        {
          type: 'field',
          value: 12345,
          msg: 'chainId must be a string',
          path: 'params.chainId',
          location: 'body',
        },
        {
          type: 'field',
          value: 123,
          msg: 'chainName must be a string',
          path: 'params.chainName',
          location: 'body',
        },
        {
          type: 'field',
          value: true,
          msg: 'senderTgId must be a string',
          path: 'params.senderTgId',
          location: 'body',
        },
      ]);
    });
  });

  describe('Isolated Reward Validator', function () {
    const validParams = {
      event: 'isolated_reward',
      params: {
        userTelegramID: '12345',
        responsePath: '/path',
        userHandle: 'handle123',
        userName: 'JohnDoe',
        patchwallet: mockWallet,
        reason: 'Some reason',
        message: 'Reward message',
        amount: '50',
        tokenAddress: mockTokenAddress,
        chainName: 'ETH',
        referentUserTelegramID: '67890',
        isSignupReward: true,
        isReferralReward: false,
        isLinkReward: true,
        delegatecall: 1,
      },
    };

    const invalidParams = {
      event: 'invalid_event',
      params: {
        userTelegramID: 12345,
        responsePath: 123,
        userHandle: true,
        userName: { name: 'JohnDoe' },
        patchwallet: '0x105E9152e3d4F5486f2953eF6578f7e25c27C3501',
        reason: 123,
        message: 123,
        amount: '-50',
        tokenAddress: '0x105E9152e3d4F5486f2953eF6578f7e25c27C3501',
        chainName: 123,
        referentUserTelegramID: 67890,
        isSignupReward: 'rue',
        isReferralReward: 'alse',
        isLinkReward: 'rue',
        delegatecall: 2,
      },
    };

    it('Should pass with valid params', async function () {
      const req = { body: validParams };
      await Promise.all(
        isolatedRewardValidator.map((middleware) =>
          middleware(req, {}, () => {}),
        ),
      );
      chai.expect(validateResult(req)).to.be.empty;
    });

    it('Should fail with invalid params', async function () {
      const req = { body: invalidParams };
      await Promise.all(
        isolatedRewardValidator.map((middleware) =>
          middleware(req, {}, () => {}),
        ),
      );

      chai
        .expect(validateResult(req).length)
        .to.equal(NUMBER_PARAMETER_TEST_ISOLATED_REWARD);

      chai.expect(validateResult(req)).to.deep.equal([
        {
          type: 'field',
          value: 'invalid_event',
          msg: 'Invalid event type',
          path: 'event',
          location: 'body',
        },
        {
          type: 'field',
          value: '0x105E9152e3d4F5486f2953eF6578f7e25c27C3501',
          msg: 'patchwallet must be a valid address',
          path: 'params.patchwallet',
          location: 'body',
        },
        {
          type: 'field',
          value: '-50',
          msg: 'Invalid amount',
          path: 'params.amount',
          location: 'body',
        },
        {
          type: 'field',
          value: '0x105E9152e3d4F5486f2953eF6578f7e25c27C3501',
          msg: 'tokenAddress must be a valid address',
          path: 'params.tokenAddress',
          location: 'body',
        },
        {
          type: 'field',
          value: 'rue',
          msg: 'isSignupReward must be a boolean',
          path: 'params.isSignupReward',
          location: 'body',
        },
        {
          type: 'field',
          value: 'alse',
          msg: 'isReferralReward must be a boolean',
          path: 'params.isReferralReward',
          location: 'body',
        },
        {
          type: 'field',
          value: 'rue',
          msg: 'isLinkReward must be a boolean',
          path: 'params.isLinkReward',
          location: 'body',
        },
        {
          type: 'field',
          value: 2,
          msg: 'delegatecall must be either 0 or 1',
          path: 'params.delegatecall',
          location: 'body',
        },
        {
          type: 'field',
          value: 12345,
          msg: 'userTelegramID must be a string',
          path: 'params.userTelegramID',
          location: 'body',
        },
        {
          type: 'field',
          value: 123,
          msg: 'responsePath must be a string',
          path: 'params.responsePath',
          location: 'body',
        },
        {
          type: 'field',
          value: true,
          msg: 'userHandle must be a string',
          path: 'params.userHandle',
          location: 'body',
        },
        {
          type: 'field',
          value: { name: 'JohnDoe' },
          msg: 'userName must be a string',
          path: 'params.userName',
          location: 'body',
        },
        {
          type: 'field',
          value: 123,
          msg: 'reason must be a string',
          path: 'params.reason',
          location: 'body',
        },
        {
          type: 'field',
          value: 123,
          msg: 'message must be a string',
          path: 'params.message',
          location: 'body',
        },
        {
          type: 'field',
          value: 123,
          msg: 'chainName must be a string',
          path: 'params.chainName',
          location: 'body',
        },
        {
          type: 'field',
          value: 67890,
          msg: 'referentUserTelegramID must be a string',
          path: 'params.referentUserTelegramID',
          location: 'body',
        },
      ]);
    });
  });
});
