import { Campaign } from '../../campaigns/entities/campaign.entity';
export declare class User {
    id: number;
    username: string;
    email: string;
    password: string;
    campaigns: Campaign[];
}
