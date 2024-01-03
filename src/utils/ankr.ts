import axios, { AxiosError } from 'axios';
import { ANKR_MULTICHAIN_API_URL } from './constants';
import { CHAIN_MAPPING } from './chains';

export async function getTokenPrice(
  chainId: string,
  contractAddress: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<axios.AxiosResponse<any, AxiosError>> {
  return await axios.post(
    ANKR_MULTICHAIN_API_URL,
    {
      jsonrpc: '2.0',
      method: 'ankr_getTokenPrice',
      params: {
        blockchain: CHAIN_MAPPING[chainId].ankr_name,
        contractAddress,
      },
      id: 1,
    },
    {
      headers: { 'Content-Type': 'application/json' },
    },
  );
}
