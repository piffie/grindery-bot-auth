import { expect } from 'chai';
import {
  isFailedTransaction,
  isPendingTransactionHash,
  isPositiveFloat,
  isSuccessfulTransaction,
} from '../../webhooks/utils';
import { TransactionStatus } from 'grindery-nexus-common-utils';

describe('Transaction Status Functions', async function () {
  describe('isSuccessfulTransaction', async function () {
    it('Should identify a successful transaction', async function () {
      expect(isSuccessfulTransaction(TransactionStatus.SUCCESS)).to.equal(true);
    });

    it('Should identify a failed transaction', async function () {
      expect(isSuccessfulTransaction(TransactionStatus.FAILURE)).to.equal(
        false,
      );
    });

    it('Should identify a pending hash transaction as not successful', async function () {
      expect(isSuccessfulTransaction(TransactionStatus.PENDING_HASH)).to.equal(
        false,
      );
    });
  });

  describe('isFailedTransaction', async function () {
    it('Should identify a failed transaction', async function () {
      expect(isFailedTransaction(TransactionStatus.FAILURE)).to.equal(true);
    });

    it('Should identify a successful transaction as not failed', async function () {
      expect(isFailedTransaction(TransactionStatus.SUCCESS)).to.equal(false);
    });

    it('Should identify a pending hash transaction as not failed', async function () {
      expect(isFailedTransaction(TransactionStatus.PENDING_HASH)).to.equal(
        false,
      );
    });
  });

  describe('isPendingTransactionHash', async function () {
    it('Should identify a pending hash transaction', async function () {
      expect(isPendingTransactionHash(TransactionStatus.PENDING_HASH)).to.equal(
        true,
      );
    });

    it('Should identify a successful transaction as not pending hash', async function () {
      expect(isPendingTransactionHash(TransactionStatus.SUCCESS)).to.equal(
        false,
      );
    });

    it('Should identify a failed transaction as not pending hash', async function () {
      expect(isPendingTransactionHash(TransactionStatus.FAILURE)).to.equal(
        false,
      );
    });
  });

  describe('isPositiveFloat', async function () {
    it('Should identify a positive float number', async function () {
      expect(isPositiveFloat('3.14')).to.equal(true);
    });

    it('Should identify zero as a positive float number', async function () {
      expect(isPositiveFloat('0')).to.equal(true);
    });

    it('Should identify a positive integer as a positive float number', async function () {
      expect(isPositiveFloat('42')).to.equal(true);
      expect(isPositiveFloat('1000000000000000')).to.equal(true);
    });

    it('Should identify a negative float number as not positive', async function () {
      expect(isPositiveFloat('-3.14')).to.equal(false);
    });

    it('Should identify a non-numeric string as not positive', async function () {
      expect(isPositiveFloat('abc')).to.equal(false);
    });

    it('Should identify an empty string as not positive', async function () {
      expect(isPositiveFloat('')).to.equal(false);
    });

    it('Should identify a string with only spaces as not positive', async function () {
      expect(isPositiveFloat('   ')).to.equal(false);
    });

    it('Should identify scientific notation as not positive', async function () {
      expect(isPositiveFloat('2.5e3')).to.equal(false);
    });
  });
});
