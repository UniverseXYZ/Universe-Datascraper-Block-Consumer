import {
  Logger,
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { Consumer } from 'sqs-consumer';
import AWS from 'aws-sdk';
import {
  ERROR_EVENT_NAME,
  PROCESSING_ERROR_EVENT_NAME,
  ReceivedMessage,
  TIMEOUT_EVENT_NAME,
  MESSAGE_PROCESSED_EVENT_NAME,
} from './sqs-consumer.types';
import { ConfigService } from '@nestjs/config';
import { EthereumService } from '../ethereum/ethereum.service';
import https from 'https';
import { NFTBlockTaskService } from '../nft-block-task/nft-block-task.service';
import { MessageStatus } from '../nft-block-task/schemas/nft-block-task.schema';
import { NFTCollectionService } from '../nft-collection/nft-collection.service';

@Injectable()
export class SqsConsumerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SqsConsumerService.name);
  public sqsConsumer: Consumer;
  public queue: AWS.SQS;

  constructor(
    private readonly configService: ConfigService,
    private readonly etherService: EthereumService,
    private readonly nftBlockTaskService: NFTBlockTaskService,
    private readonly nftCollectionService: NFTCollectionService,
  ) {
    const region = this.configService.get('aws.region');
    const accessKeyId = this.configService.get('aws.accessKeyId');
    const secretAccessKey = this.configService.get('aws.secretAccessKey');

    if (!region || !accessKeyId || !secretAccessKey) {
      throw new Error(
        'Initialize AWS queue failed, please check required variables',
      );
    }

    AWS.config.update({
      region,
      accessKeyId,
      secretAccessKey,
    });
  }

  public onModuleInit() {
    this.logger.log('onModuleInit');
    this.queue = new AWS.SQS({
      httpOptions: {
        agent: new https.Agent({
          keepAlive: true,
        }),
      },
    });
    this.sqsConsumer = Consumer.create({
      queueUrl: this.configService.get('aws.queueUrl'),
      sqs: this.queue,
      handleMessage: this.handleMessage.bind(this),
    });

    this.logger.log('Register events');
    //listen to events
    this.sqsConsumer.addListener(ERROR_EVENT_NAME, this.onError.bind(this));
    this.sqsConsumer.addListener(
      PROCESSING_ERROR_EVENT_NAME,
      this.onProcessingError.bind(this),
    );
    this.sqsConsumer.addListener(
      TIMEOUT_EVENT_NAME,
      this.onTimeoutError.bind(this),
    );
    this.sqsConsumer.addListener(
      MESSAGE_PROCESSED_EVENT_NAME,
      this.onMessageProcessed.bind(this),
    );

    this.logger.log('Consumer starts');
    this.sqsConsumer.start();
  }

  public onModuleDestroy() {
    this.logger.log('Consumer stops');
    this.sqsConsumer.stop();
  }

  async handleMessage(message: AWS.SQS.Message) {
    this.logger.log(`Consumer handle message id:(${message.MessageId})`);
    const receivedMessage = JSON.parse(message.Body) as ReceivedMessage;

    const nftBlockTask = {
      messageId: message.MessageId,
      blockNum: receivedMessage.blockNum,
    };

    this.logger.log(`Set message id:(${message.MessageId}) as processing`);
    await this.nftBlockTaskService.updateNFTBlockTask({
      ...nftBlockTask,
      status: MessageStatus.processing,
    });
    this.logger.log(
      `analyzing contracts in block number: ${nftBlockTask.blockNum}`,
    );
    const contracts = await this.etherService.getContractsInBlock(
      nftBlockTask.blockNum,
    );

    this.logger.log(`Write nft contracts (${contracts?.length}) to db`);
    //write batch to db
    await this.nftCollectionService.insertIfNotThere(
      contracts.map((contract) => ({
        contractAddress: contract.contractAddress,
        tokenType: contract.tokenType === 'ERC721' ? 'ERC721' : 'ERC1155',
      })),
    );
  }

  onError(error: Error, message: AWS.SQS.Message) {
    this.logger.log(`SQS error ${error.message}`);
    this.handleError(error, message, 'SQS');
  }

  onProcessingError(error: Error, message: AWS.SQS.Message) {
    this.logger.log(`Processing error ${error.message}`);
    this.handleError(error, message, 'Processing');
  }

  onTimeoutError(error: Error, message: AWS.SQS.Message) {
    this.logger.log(`Timeout error ${error.message}`);
    this.handleError(error, message, 'Timeout');
  }

  onMessageProcessed(message: AWS.SQS.Message) {
    this.nftBlockTaskService.removeNTFBlockTask(message.MessageId);
    this.logger.log(`Messages ${message?.MessageId} have been processed`);
  }

  private handleError(error: Error, message: AWS.SQS.Message, type: string) {
    const receivedMessage = JSON.parse(message.Body) as ReceivedMessage;

    const nftBlockTask = {
      messageId: message.MessageId,
      blockNum: receivedMessage.blockNum,
    };

    this.nftBlockTaskService.updateNFTBlockTask({
      ...nftBlockTask,
      status: MessageStatus.error,
      errorMessage:
        `Error type: [${type}] - ${error.message}` ||
        `Error type: [${type}] - ${JSON.stringify(error)}`,
    });
    this.deleteMessage(message);
  }

  private async deleteMessage(message: AWS.SQS.Message) {
    const deleteParams = {
      QueueUrl: this.configService.get('aws.queueUrl'),
      ReceiptHandle: message.ReceiptHandle,
    };

    try {
      await this.queue.deleteMessage(deleteParams).promise();
    } catch (err) {
      this.logger.log(`Deleting Message(${message?.MessageId}) ERROR`);
    }
  }
}
