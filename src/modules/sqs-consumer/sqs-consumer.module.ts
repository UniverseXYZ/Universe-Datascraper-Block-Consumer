import { Module } from '@nestjs/common';
import { EthereumModule } from '../ethereum/ethereum.module';
import { NFTBlockTaskModule } from '../nft-block-task/nft-block-task.module';
import { NFTCollectionModule } from '../nft-collection/nft-collection.module';
import { SqsConsumerService } from './sqs-consumer.service';

@Module({
  imports: [EthereumModule, NFTBlockTaskModule, NFTCollectionModule],
  providers: [SqsConsumerService],
  exports: [SqsConsumerService],
})
export class SqsConsumerModule {}
