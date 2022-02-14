import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateNFTBlockTaskDto } from './dto/create-nft-block-task.dto';
import {
  NFTBlockTask,
  NFTBlockTaskDocument,
} from './schemas/nft-block-task.schema';

@Injectable()
export class NFTBlockTaskService {
  private readonly logger = new Logger(NFTBlockTaskService.name);
  constructor(
    @InjectModel(NFTBlockTask.name)
    private readonly NFTBlockTaskModel: Model<NFTBlockTaskDocument>,
  ) {}

  async updateNFTBlockTask(task: CreateNFTBlockTaskDto): Promise<void> {
    this.logger.log(`update task ${task.messageId} status (${task.status})`);
    await this.NFTBlockTaskModel.updateOne(
      { messageId: task.messageId },
      { $set: { status: task.status } },
      { upsert: true },
    );
  }

  async removeNTFBlockTask(messageId: string) {
    this.logger.log(`remove task ${messageId}`);
    await this.NFTBlockTaskModel.deleteOne({
      messageId,
    });
  }
}
