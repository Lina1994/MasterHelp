import { User } from '../users/entities/user.entity';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Campaign } from './entities/campaign.entity';
import { CampaignPlayer } from './entities/campaign-player.entity';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';
import { InvitePlayerDto } from './dto/invite-player.dto';
import { RespondInvitationDto } from './dto/respond-invitation.dto';
import { UsersService } from '../users/users.service';
import { NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';

@Injectable()
export class CampaignsService {
  constructor(
    @InjectRepository(Campaign)
    private campaignsRepository: Repository<Campaign>,
    @InjectRepository(CampaignPlayer)
    private campaignPlayersRepository: Repository<CampaignPlayer>,
    private readonly usersService: UsersService,
  ) {}


  async findAllForUser(userId: number): Promise<Campaign[]> {
    // Campañas donde el usuario es owner
    const asOwner = await this.campaignsRepository.find({
      where: { owner: { id: userId } },
      relations: ['players', 'owner'],
    });
    // Campañas donde el usuario es player
    const asPlayer = await this.campaignPlayersRepository.find({
      where: { user: { id: userId } },
      relations: ['campaign', 'campaign.owner', 'campaign.players'],
    });
    // Extraer campañas únicas
    const playerCampaigns = asPlayer.map(cp => cp.campaign);
    const all = [...asOwner, ...playerCampaigns];
    // Eliminar duplicados por id
    const unique = all.filter((c, i, arr) => arr.findIndex(x => x.id === c.id) === i);
    return unique;
  }

  async findOne(id: number): Promise<Campaign | undefined> {
  return this.campaignsRepository.findOne({ where: { id: id as any }, relations: ['players', 'owner'] });
  }


  async createWithOwner(createCampaignDto: CreateCampaignDto, ownerId: number): Promise<Campaign> {
    // Buscar el usuario owner
    const owner = await this.campaignsRepository.manager.findOne(User, { where: { id: ownerId } });
    if (!owner) throw new Error('Owner user not found');
    const campaign = this.campaignsRepository.create({ ...createCampaignDto, owner });
    return this.campaignsRepository.save(campaign);
  }

  async update(id: number, updateCampaignDto: UpdateCampaignDto): Promise<Campaign> {
    await this.campaignsRepository.update(id, updateCampaignDto);
    return this.findOne(id) as Promise<Campaign>;
  }

  async remove(id: number): Promise<void> {
    await this.campaignsRepository.delete(id);
  }

  // --- INVITATION LOGIC ---

  async invitePlayer(ownerId: number, dto: InvitePlayerDto) {
    // Find campaign and check ownership
    const campaign = await this.campaignsRepository.findOne({ where: { id: dto.campaignId }, relations: ['owner', 'players', 'players.user'] });
    if (!campaign) throw new NotFoundException('Campaign not found');
    if (campaign.owner.id !== ownerId) throw new ForbiddenException('Only the campaign owner can invite players');

    // Find user by email or username
    let user: User | undefined;
    if (dto.email) {
      user = await this.usersService['usersRepository'].findOne({ where: { email: dto.email } });
    } else if (dto.username) {
      user = await this.usersService['usersRepository'].findOne({ where: { username: dto.username } });
    }
    if (!user) throw new NotFoundException('User not found');

    // Check if already invited or player
    const existing = campaign.players.find(p => p.user.id === user!.id);
    if (existing) {
      if (existing.status === 'invited') throw new BadRequestException('User already invited');
      if (existing.status === 'active') throw new BadRequestException('User is already a player');
      if (existing.status === 'declined') {
        // Re-invite: update status
        existing.status = 'invited';
        await this.campaignPlayersRepository.save(existing);
        return { message: 'User re-invited' };
      }
    } else {
      // Create invitation
      const invitation = this.campaignPlayersRepository.create({
        campaign,
        user,
        role: 'player',
        status: 'invited',
      });
      await this.campaignPlayersRepository.save(invitation);
    }
    return { message: 'Invitation sent' };
  }

  async respondInvitation(userId: number, dto: RespondInvitationDto) {
    // Find invitation
    const invitation = await this.campaignPlayersRepository.findOne({ where: { id: dto.invitationId }, relations: ['user'] });
    if (!invitation) throw new NotFoundException('Invitation not found');
    if (invitation.user.id !== userId) throw new ForbiddenException('Not your invitation');
    if (invitation.status !== 'invited') throw new BadRequestException('Invitation already responded');

    if (dto.response === 'accept') {
      invitation.status = 'active';
    } else if (dto.response === 'decline') {
      invitation.status = 'declined';
    } else {
      throw new BadRequestException('Invalid response');
    }
    await this.campaignPlayersRepository.save(invitation);
    return { message: `Invitation ${dto.response}ed` };
  }

  async getPendingInvitations(userId: number) {
    // List invitations for user with status 'invited'
    const invitations = await this.campaignPlayersRepository.find({
      where: { user: { id: userId }, status: 'invited' },
      relations: ['campaign', 'campaign.owner'],
    });
    return invitations;
  }
}
