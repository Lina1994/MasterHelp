import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { CampaignsService } from '../campaigns.service';

@Injectable()
export class CampaignOwnerGuard implements CanActivate {
  constructor(private readonly campaignsService: CampaignsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.userId;
    // Support both :id and :campaignId as URL parameters
    const campaignId = request.params.id || request.params.campaignId;

    if (!userId) {
      throw new ForbiddenException('Authentication details are missing.');
    }

    if (!campaignId) {
      throw new ForbiddenException('Campaign ID not found in URL parameters.');
    }

    const campaign = await this.campaignsService.findOne(campaignId);

    if (!campaign) {
      throw new NotFoundException(`Campaign with ID ${campaignId} not found.`);
    }

    if (campaign.owner.id !== userId) {
      throw new ForbiddenException('You are not the owner of this campaign.');
    }

    return true;
  }
}
