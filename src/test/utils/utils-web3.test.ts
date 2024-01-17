/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { expect } from 'chai';
import {
  getUserBalanceNative,
  numberToString,
  scaleDecimals,
  weiToEther,
} from '../../utils/web3';
import BN from 'bn.js';
import Sinon from 'sinon';
import { mockChainId } from '../utils';
import { chainMethods } from '../../utils/chains';

describe('Web3 utils ', async function () {
  let sandbox: sinon.SinonSandbox;
  let balanceMock;

  beforeEach(async function () {
    sandbox = Sinon.createSandbox();

    const fakeWeb3Instance: any = {
      eth: {
        getBalance: sandbox
          .stub()
          .callsFake(async () => '100100000000000000000'),
      },
    };

    balanceMock = sandbox
      .stub(chainMethods, 'getWeb3Chain')
      .callsFake((_chainId: string) => fakeWeb3Instance);
  });

  afterEach(function () {
    sandbox.restore();
  });

  describe('numberToString', async function () {
    it('Should convert a valid string number to string', async function () {
      expect(numberToString('42')).to.equal('42');
      expect(numberToString('8.15')).to.equal('8.15');
      expect(numberToString('-50')).to.equal('-50');
      expect(numberToString('-3.14')).to.equal('-3.14');
      expect(numberToString('0')).to.equal('0');
    });

    it('Should throw an error if string is invalid', async function () {
      expect(() => numberToString('/42'))
        .to.throw(Error)
        .with.property(
          'message',
          "while converting number to string, invalid number value '/42', should be a number matching (^-?[0-9.]+).",
        );
      expect(() => numberToString('&42'))
        .to.throw(Error)
        .with.property(
          'message',
          "while converting number to string, invalid number value '&42', should be a number matching (^-?[0-9.]+).",
        );
      expect(() => numberToString(' 42'))
        .to.throw(Error)
        .with.property(
          'message',
          "while converting number to string, invalid number value ' 42', should be a number matching (^-?[0-9.]+).",
        );
    });

    it('Should convert a number to string', async function () {
      expect(numberToString(42)).to.equal('42');
      expect(numberToString(8.15)).to.equal('8.15');
      expect(numberToString(-50)).to.equal('-50');
      expect(numberToString(-3.14)).to.equal('-3.14');
      expect(numberToString(0)).to.equal('0');
    });

    it('Should convert an object with toString method to string', async function () {
      let customValue = '42';
      const objWithToString = {
        toString: () => customValue.toString(),
        toTwos: () => '',
        dividedToIntegerBy: () => '',
      };
      expect(numberToString(objWithToString)).to.equal('42');
      customValue = '8.15';
      expect(numberToString(objWithToString)).to.equal('8.15');
      customValue = '-50';
      expect(numberToString(objWithToString)).to.equal('-50');
      customValue = '-3.14';
      expect(numberToString(objWithToString)).to.equal('-3.14');
      customValue = '0';
      expect(numberToString(objWithToString)).to.equal('0');
    });

    it('Should throw an error for invalid inputs', async function () {
      expect(() => numberToString('invalid'))
        .to.throw(Error)
        .with.property(
          'message',
          "while converting number to string, invalid number value 'invalid', should be a number matching (^-?[0-9.]+).",
        );
      expect(() => numberToString({}))
        .to.throw(Error)
        .with.property(
          'message',
          "while converting number to string, invalid number value '[object Object]' type object.",
        );
      expect(() => numberToString([]))
        .to.throw(Error)
        .with.property(
          'message',
          "while converting number to string, invalid number value '' type object.",
        );
    });
  });

  describe('scaleDecimals', async function () {
    it('Should correctly integer decimals', async function () {
      const decimals = 18;
      const weiValue = scaleDecimals('50', decimals);
      expect(weiValue).to.equal('50000000000000000000');
    });

    it('Should correctly scale decimals', async function () {
      const decimals = 18;
      const weiValue = scaleDecimals('1.23456789', decimals);
      expect(weiValue).to.equal('1234567890000000000');
    });

    it('Should handle negative numbers', async function () {
      const decimals = 10;
      const weiValue = scaleDecimals('-123.456789', decimals);
      expect(weiValue).to.equal('-1234567890000');
    });

    it('Should handle zero number', async function () {
      const decimals = 8;
      const weiValue = scaleDecimals('0', decimals);
      expect(weiValue).to.equal('0');
    });

    it('Should handle decimals with trailing zeros', async function () {
      const decimals = 10;
      const weiValue = scaleDecimals('123.400000', decimals);
      expect(weiValue).to.equal('1234000000000');
    });

    it('Should throw an error for value being only a dot', async function () {
      const decimals = 18;
      expect(() => scaleDecimals('.', decimals)).to.throw(
        Error,
        '[ethjs-unit] while converting number . to wei, invalid value',
      );
    });

    it('Should throw an error for too many decimal points', async function () {
      const decimals = 18;
      expect(() => scaleDecimals('1.2.3', decimals)).to.throw(
        Error,
        '[ethjs-unit] while converting number 1.2.3 to wei, too many decimal points',
      );
    });

    it('Should throw an error for too many decimal places', async function () {
      const decimals = 6;
      expect(() =>
        scaleDecimals('123.45678321312312312329', decimals),
      ).to.throw(
        Error,
        '[ethjs-unit] while converting number 123.45678321312312312329 to wei, too many decimal places',
      );
    });

    it('Should throw an error for invalid characters', async function () {
      const decimals = 18;
      expect(() => scaleDecimals('1a2b3c4d', decimals)).to.throw(
        Error,
        "while converting number to string, invalid number value '1a2b3c4d', should be a number matching (^-?[0-9.]+)",
      );
    });
  });

  describe('weiToEther', async function () {
    it('should correctly convert Wei to Ether with full decimals', async function () {
      const result = weiToEther(new BN('1000000000000000000'));
      expect(result).to.equal('1');
    });

    it('should handle specified decimal precision', async function () {
      const result = weiToEther('1234567890000000000', 5);
      expect(result).to.equal('12345678900000');
    });

    it('should handle zero Wei value', async function () {
      const result = weiToEther(0, 10);
      expect(result).to.equal('0');
    });

    it('should handle small Wei values', async function () {
      const result = weiToEther('123', 5);
      expect(result).to.equal('0.00123');
    });

    it('should handle very large Wei values', async function () {
      const result = weiToEther(new BN('123456789012345678901234567890'), 2);
      expect(result).to.equal('1.2345678901234568e+27');
    });

    it('should return whole number if decimals is zero', async function () {
      const result = weiToEther('5500000000000000000', 0);
      expect(result).to.equal('5500000000000000000');
    });

    it('should throw an error for non-numeric Wei values', async function () {
      expect(() => weiToEther('invalidWeiValue', 10)).to.throw();
    });
  });

  describe('getUserBalanceNative', async function () {
    it('should return the user balance converted into Ether', async function () {
      // Arrange
      const fakeWeb3Instance: any = {
        eth: {
          getBalance: sandbox
            .stub()
            .callsFake(async () => '1022286187188978853816'),
        },
      };

      balanceMock.callsFake((_chainId: string) => fakeWeb3Instance);

      // Act & Assert
      expect(await getUserBalanceNative('xx', mockChainId)).to.equal(
        '1022.286187188978853816',
      );
    });

    it('should return the user balance as zero when the balance is zero', async function () {
      // Arrange
      const fakeWeb3Instance: any = {
        eth: {
          getBalance: sandbox.stub().callsFake(async () => '0'),
        },
      };

      balanceMock.callsFake((_chainId: string) => fakeWeb3Instance);

      // Act & Assert
      expect(await getUserBalanceNative('xx', mockChainId)).to.equal('0');
    });
  });
});
