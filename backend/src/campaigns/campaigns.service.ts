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

  // --- Eliminar jugador de campaña (solo owner) ---
  async removePlayer(campaignId: string, playerId: string) {
    // La propiedad ya fue verificada por CampaignOwnerGuard.
    // Aún necesitamos la campaña para la lógica interna.
    const campaign = await this.campaignsRepository.findOne({
      where: { id: campaignId },
      relations: ['owner'],
    });
    if (!campaign) throw new NotFoundException('Campaign not found');

    const campaignPlayer = await this.campaignPlayersRepository.findOne({
      where: { id: playerId },
      relations: ['user', 'campaign'],
    });
    if (!campaignPlayer) throw new NotFoundException('Player not found');

    // Lógica de negocio: El owner no puede eliminarse a sí mismo por esta vía.
    if (campaignPlayer.user.id === campaign.owner.id)
      throw new ForbiddenException('Owner cannot remove themselves');

    await this.campaignPlayersRepository.delete(playerId);
    return { message: 'Player removed' };
  }

  async findAllForUser(userId: number): Promise<Campaign[]> {
    const asOwner = await this.campaignsRepository.find({
      where: { owner: { id: userId } },
      relations: ['players', 'players.user', 'owner'],
    });
    const asPlayer = await this.campaignPlayersRepository.find({
      where: { user: { id: userId } },
      relations: ['campaign', 'campaign.owner', 'campaign.players', 'campaign.players.user'],
    });
    const playerCampaigns = asPlayer.map((cp) => cp.campaign);
    const all = [...asOwner, ...playerCampaigns];
    const unique = all.filter((c, i, arr) => arr.findIndex((x) => x.id === c.id) === i);
    return unique;
  }

  async findOne(id: string): Promise<Campaign | undefined> {
    return this.campaignsRepository.findOne({
      where: { id },
      relations: ['players', 'players.user', 'owner'],
    });
  }

  async createWithOwner(createCampaignDto: CreateCampaignDto, ownerId: number): Promise<Campaign> {
    const owner = await this.campaignsRepository.manager.findOne(User, { where: { id: ownerId } });
    if (!owner) throw new Error('Owner user not found');
    const campaign = this.campaignsRepository.create({ ...createCampaignDto, owner });
    const savedCampaign = await this.campaignsRepository.save(campaign);
    return this.findOne(savedCampaign.id) as Promise<Campaign>;
  }

  async update(id: string, updateCampaignDto: UpdateCampaignDto): Promise<Campaign> {
    // La propiedad ya fue verificada por CampaignOwnerGuard.
    await this.campaignsRepository.update(id, updateCampaignDto);
    return this.findOne(id) as Promise<Campaign>;
  }

  async remove(id: string): Promise<void> {
    // La propiedad ya fue verificada por CampaignOwnerGuard.
    await this.campaignsRepository.delete(id);
  }

  // --- INVITATION LOGIC ---

  async invitePlayer(campaignId: string, dto: InvitePlayerDto) {
    // La propiedad ya fue verificada por CampaignOwnerGuard.
    const campaign = await this.campaignsRepository.findOne({
      where: { id: campaignId },
      relations: ['owner', 'players', 'players.user'],
    });
    if (!campaign) throw new NotFoundException('Campaign not found');

    let user: User | undefined;
    if (dto.email) {
      user = await this.usersService['usersRepository'].findOne({ where: { email: dto.email } });
    } else if (dto.username) {
      user = await this.usersService['usersRepository'].findOne({
        where: { username: dto.username },
      });
    }
    if (!user) throw new NotFoundException('User not found');

    const existing = campaign.players.find((p) => p.user.id === user!.id);
    if (existing) {
      if (existing.status === 'invited') throw new BadRequestException('User already invited');
      if (existing.status === 'active') throw new BadRequestException('User is already a player');
      if (existing.status === 'declined') {
        existing.status = 'invited';
        await this.campaignPlayersRepository.save(existing);
        return { message: 'User re-invited' };
      }
    } else {
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
    const invitation = await this.campaignPlayersRepository.findOne({
      where: { id: dto.invitationId },
      relations: ['user'],
    });
    if (!invitation) throw new NotFoundException('Invitation not found');
    if (invitation.user.id !== userId) throw new ForbiddenException('Not your invitation');
    if (invitation.status !== 'invited')
      throw new BadRequestException('Invitation already responded');

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
    const invitations = await this.campaignPlayersRepository.find({
      where: { user: { id: userId }, status: 'invited' },
      relations: ['campaign', 'campaign.owner'],
    });
    return invitations;
  }
}
