import { UsersService } from './users.service';
export declare class UsersController {
    private readonly usersService;
    constructor(usersService: UsersService);
    updatePreferences(req: any, body: {
        language?: string;
        theme?: string;
    }): Promise<import("./entities/user.entity").User>;
    getMe(req: any): Promise<import("./entities/user.entity").User>;
    findOne(id: number): Promise<import("./entities/user.entity").User>;
    deleteMe(req: any): Promise<void>;
}
