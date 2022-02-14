import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateNFTCollectionDto } from './dto/create-nft-collection.dto';
import {
  NFTCollection,
  NFTCollectionDocument,
} from './schemas/nft-collection.shema';

@Injectable()
export class NFTCollectionService {
  private readonly logger = new Logger(NFTCollectionService.name);

  constructor(
    @InjectModel(NFTCollection.name)
    private readonly nftCollectionModel: Model<NFTCollectionDocument>,
  ) {}

  public async findUnprocessedOne() {
    return await this.nftCollectionModel.findOne({
      sentAt: null,
      firstCheckAt: null,
    });
  }

  public async markAsChecked(contractAddress: string) {
    await this.nftCollectionModel.updateOne(
      {
        contractAddress,
      },
      {
        firstCheckAt: new Date(),
      },
    );
  }

  public async markAsProcessed(contractAddress: string) {
    await this.nftCollectionModel.updateOne(
      {
        contractAddress,
      },
      {
        sentAt: new Date(),
      },
    );
  }

  public async insertIfNotThere(collections: CreateNFTCollectionDto[]) {
    const query = {
      contractAddress: {
        $in: collections.map((collection) => collection.contractAddress),
      },
    };

    const existingCollections = await this.nftCollectionModel.find(query);

    const needToBeUpdated = collections.filter((collection) =>
      existingCollections.find(
        (e) => e.createdAtBlock > collection.createdAtBlock,
      ),
    );
    const needToBeInserted = collections.filter(
      (collection) =>
        !existingCollections.find(
          (e) => e.contractAddress === collection.contractAddress,
        ),
    );

    if (needToBeInserted.length > 0) {
      console.log(needToBeInserted);
      await this.nftCollectionModel.bulkWrite(
        needToBeInserted.map((collection) => ({
          updateOne: {
            filter: {
              contractAddress: collection.contractAddress,
            },
            update: {
              $set: { ...collection },
            },
            upsert: true,
          },
        })),
      );
    }

    if (needToBeUpdated.length > 0) {
      await this.nftCollectionModel.bulkWrite(
        needToBeUpdated.map((collection) => ({
          updateOne: {
            filter: {
              contractAddress: collection.contractAddress,
            },
            update: {
              $set: { createdAtBlock: collection.createdAtBlock },
            },
            upsert: false,
          },
        })),
      );
    }
  }
}
