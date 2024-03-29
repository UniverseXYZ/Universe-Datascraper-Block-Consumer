// Infura error
// { code: -32005, message: 'query returned more than 10000 results' }

// Alchemy
// {
//   code: -32602,
//   message: 'Log response size exceeded. You can make eth_getLogs requests with up to a 2K block range and no limit on the response size, or you can request any block range with a cap of 10K logs in the response. Based on your parameters and the response size limit, this block range should work: [0xc5dc00, 0xc614a7]'
// }
export interface TransferHistoryError {
  code: number;
  message: string;
}

export interface TransferHistory {
  blockNum: number;
  contractAddress: string;
  from: string;
  to: string;
  hash: string;
  value?: string;
  erc721TokenId: string;
  erc1155Metadata?: any;
  asset?: string;
  category: string;
  // timestamp: number;
}

export interface BlockTimestamp {
  blockNumber: number;
  timestamp: number;
}

export class SizeExceedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SizeExceedError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
