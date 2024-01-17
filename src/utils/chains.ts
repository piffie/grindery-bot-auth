import Web3 from 'web3';
import {
  ALCHEMY_API_KEY,
  ANKR_KEY,
  GETBLOCK_API_KEY,
  LAVANET_API_KEY,
  CHAINSTACK_API_KEY,
  CHAINSTACK_API_KEY_2,
} from '../../secrets';
import { ChainInfo } from '../types/chains.types';

/**
 * Retrieves ANKR WebSocket and HTTP endpoints based on the provided network name.
 * @param name The network name.
 * @returns An array containing WebSocket and HTTP endpoints.
 */
const ANKR = (name: string) => [
  `wss://rpc.ankr.com/${name}/ws/${ANKR_KEY || ''}`,
  `https://rpc.ankr.com/${name}/${ANKR_KEY || ''}`,
];

/**
 * Retrieves ALCHEMY WebSocket and HTTP endpoints based on the provided network name.
 * @param name The network name.
 * @returns An array containing WebSocket and HTTP endpoints.
 */
const ALCHEMY = (name: string) => [
  `wss://${name}.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
  `https://${name}.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
];

/**
 * Retrieves LAVANET WebSocket and HTTP endpoints based on the provided WebSocket and HTTP paths.
 * @param wsPath The WebSocket path.
 * @param httpsPath The HTTP path.
 * @returns An array containing WebSocket and HTTP endpoints.
 */
const LAVANET = (wsPath: string, httpsPath: string) => [
  `wss://g.w.lavanet.xyz:443/gateway/${wsPath}/${LAVANET_API_KEY}`,
  `https://g.w.lavanet.xyz:443/gateway/${httpsPath}/${LAVANET_API_KEY}`,
];

/**
 * Retrieves CHAINSTACK WebSocket and HTTP endpoints based on the provided node ID and key.
 * @param nodeId The node ID.
 * @param key The key.
 * @returns An array containing WebSocket and HTTP endpoints.
 */
const CHAINSTACK = (nodeId: string, key: string) => [
  `wss://ws-${nodeId}.p2pify.com/${key || CHAINSTACK_API_KEY}`,
  `https://${nodeId}.p2pify.com/${key || CHAINSTACK_API_KEY}`,
];

export const CHAIN_MAPPING: Record<string, ChainInfo> = {
  'eip155:1': {
    endpoint: ANKR('eth'),
    name_patch: 'eth',
    name_display: 'Ethereum',
    explorer: 'https://etherscan.io/tx/',
    ankr_name: 'eth',
  },
  'eip155:42161': {
    endpoint: ANKR('arbitrum'),
    name_patch: 'arb1',
    name_display: 'Arbitrum',
    explorer: 'https://arbiscan.io/tx/',
    ankr_name: 'arbitrum',
  },
  'eip155:100': {
    endpoint: ANKR('gnosis'),
    name_patch: 'gno',
    name_display: 'Gnosis',
    explorer: 'https://gnosisscan.io/tx/',
    ankr_name: 'gnosis',
  },
  'eip155:137': {
    endpoint: ANKR('polygon'),
    name_patch: 'matic',
    explorer: 'https://polygonscan.com/tx/',
    name_display: 'Polygon',
    ankr_name: 'polygon',
  },
  'eip155:42220': {
    endpoint: ANKR('celo'),
    name_display: 'Celo',
    explorer: 'https://celoscan.io/tx/',
  },
  'eip155:43114': {
    endpoint: ANKR('avalanche'),
    name_display: 'Avalanche',
    explorer: 'https://avascan.info/blockchain/c/tx/',
    ankr_name: 'avalanche',
  },
  'eip155:56': {
    endpoint: ANKR('bsc'),
    name_patch: 'bnb',
    name_display: 'Binance Smart Chain',
    explorer: 'https://bscscan.com/tx/',
    ankr_name: 'bsc',
  },
  'eip155:250': {
    endpoint: ANKR('fantom'),
    name_display: 'Fantom',
    explorer: 'https://ftmscan.com/tx/',
    ankr_name: 'fantom',
  },
  'eip155:1666600000': {
    endpoint: ANKR('harmony'),
    name_display: 'Harmony',
    explorer: 'https://explorer.harmony.one/tx/',
  },
  'eip155:25': {
    endpoint: [
      `wss://cro.getblock.io/${GETBLOCK_API_KEY}/mainnet/`,
      `https://cro.getblock.io/${GETBLOCK_API_KEY}/mainnet/`,
    ],
    name_display: 'Cronos',
    explorer: 'https://cronoscan.com/tx/',
  },
  'eip155:1101': {
    endpoint: ANKR('polygon_zkevm'),
    name_display: 'Polygon ZKEVM',
    explorer: 'https://zkevm.polygonscan.com/tx/',
    ankr_name: 'polygon_zkevm',
  },
  'eip155:1284': {
    endpoint: ANKR('moonbeam'),
    name_display: 'Moonbeam',
    explorer: 'https://moonscan.io/tx/',
  },
  'eip155:80001': {
    endpoint: ANKR('polygon_mumbai'),
    name_patch: 'maticmum',
    name_display: 'Polygon Mumbai',
    explorer: 'https://mumbai.polygonscan.com/tx/',
    ankr_name: 'polygon_mumbai',
  },
  'eip155:5': {
    endpoint: ALCHEMY('eth-goerli'),
    name_display: 'Ethereum Goerli',
    explorer: 'https://goerli.etherscan.io/tx/',
    ankr_name: 'eth_goerli',
  },
  'eip155:11155111': {
    endpoint: ANKR('eth_sepolia'),
    name_display: 'Ethereum Sepolia',
    explorer: 'https://sepolia.etherscan.io/tx/',
  },
  'eip155:97': {
    endpoint: CHAINSTACK('nd-519-425-794', CHAINSTACK_API_KEY_2),
    name_display: 'nd-519-425-794',
    explorer: '',
  },
  'eip155:4002': {
    endpoint: ANKR('fantom_testnet'),
    name_display: 'Fantom Testnet',
    explorer: 'https://testnet.ftmscan.com/tx/',
  },
  'eip155:1442': {
    endpoint: ANKR('polygon_zkevm_testnet'),
    name_display: 'Polygon ZKEVM Testnet',
    explorer: 'https://testnet-zkevm.polygonscan.com/tx/',
  },
  'eip155:338': {
    endpoint: CHAINSTACK('nd-326-373-985', CHAINSTACK_API_KEY_2),
    name_display: 'nd-326-373-985',
    explorer: '',
  },
  'eip155:44787': {
    endpoint: LAVANET('alfajores/rpc', 'alfajores/rpc-http'),
    name_display: 'Alfajores',
    explorer: 'https://alfajores.celoscan.io/tx/',
  },
  'eip155:9000': {
    endpoint: LAVANET('evmost/json-rpc', 'evmost/json-rpc-http'),
    name_display: 'Evmos',
    explorer: 'https://escan.live/tx/',
  },
  'eip155:59144': {
    endpoint: ANKR('linea'),
    name_patch: 'linea',
    explorer: 'https://lineascan.build/tx/',
    name_display: 'Linea',
    ankr_name: 'linea',
  },
};

/**
 * Retrieves a Web3 instance for a specific blockchain based on the given chain ID.
 *
 * @param {string} chainId - The chain ID representing a specific blockchain.
 * @returns {Web3} - An instance of the Web3 class configured for the specified blockchain.
 */
function getWeb3Chain(chainId: string): Web3 {
  return new Web3(CHAIN_MAPPING[chainId].endpoint[1]);
}

/**
 * Object containing methods related to blockchain interactions.
 */
export const chainMethods = {
  getWeb3Chain,
};
