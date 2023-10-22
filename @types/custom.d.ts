import { IUser } from "../models/user.model";
import { Request } from "../models/user.model";

declare global {
  namespace Express {
    interface Request {
      user?: IUser;
    }
  }
}
