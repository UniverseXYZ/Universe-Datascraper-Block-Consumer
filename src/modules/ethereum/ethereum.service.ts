import { Injectable, Logger } from '@nestjs/common';
import { EthereumNetworkType, InfuraProject, ProviderOptions } from './interface';
import { ethers } from 'ethers';
import { ConfigService } from '@nestjs/config';

const ERC165ABI = [
  {
    constant: true,
    inputs: [{ internalType: 'bytes4', name: '', type: 'bytes4' }],
    name: 'supportsInterface',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    payable: false,
    stateMutability: 'view',
    type: 'function',
  },
];

@Injectable()
export class EthereumService {
  public ether: ethers.providers.BaseProvider;

  constructor(private configService: ConfigService) {
    const network: ethers.providers.Networkish = this.configService.get('ethereum_network');
    const quorum: number = Number(this.configService.get('ethereum_quorum'));

    const projectSecret: string = this.configService.get('infura.project_secret');
    const projectId: string = this.configService.get('infura.project_id');
    const infura:InfuraProject = projectId && projectSecret
      ? { projectId, projectSecret }
      : undefined;
      
    const alchemyToken: string = this.configService.get('alchemy_token')
    const alchemy: string = alchemyToken ? alchemyToken : undefined

    if (!infura && !alchemy) {
      throw new Error('Infura project id and secret or alchemy token is not defined');
    }
        
    const opts: ProviderOptions = {
      quorum: quorum,
      alchemy: alchemy,
      infura: infura
    }
    
    const ethersProvider: ethers.providers.BaseProvider = ethers.getDefaultProvider(network, opts);
    this.ether = ethersProvider;
  }

  async getContractsInBlock(blockNum: number) {
    const block = await this.ether.getBlockWithTransactions(blockNum);
    const transactions = block.transactions;
    const allAddress = transactions.map((transaction) => {
      return [transaction.from, transaction.to];
    });
    const provider = this.ether;

    const uniqueAddress = [...new Set(allAddress.flat())];
    const resultPromises = uniqueAddress.map(async (address) => {
      try {
        const contract = new ethers.Contract(address, ERC165ABI, provider);
        const type = await getERCtype(contract);
        return { contractAddress: address, tokenType: type };
      } catch (error) {
        return { contractAddress: address, tokenType: undefined };
      }
    });
    const result = await Promise.all(resultPromises);
    return result.filter((r) => r.tokenType !== undefined);
  }
}

async function getERCtype(contract: any) {
  try {
    const is721 = await contract.supportsInterface('0x80ac58cd');
    if (is721) {
      return 'ERC721';
    }
    const is1155 = await contract.supportsInterface('0xd9b67a26');
    if (is1155) {
      return 'ERC1155';
    }
  } catch (error) {
    return undefined;
  }
  return undefined;
}
