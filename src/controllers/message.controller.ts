import { NextFunction, Request, Response } from "express";
import Message from "../models/message.model";
import User from "../models/user.model";
import { AppError } from "../utils/AppError";
import { getConversationKey } from "../utils/chat";
import { verify_token } from "../utils/helpers";

const getBearerToken = (authorization?: string) =>
  authorization?.startsWith("Bearer ") ? authorization.slice(7) : "";

const getAuthenticatedUser = async (authorization?: string) => {
  const token = getBearerToken(authorization);

  if (!token) {
    throw new AppError("Authorization token is required", 401);
  }

  const tokenSubject = verify_token(token);
  const user = await User.findOne({
    $or: [{ email: tokenSubject }, { phoneNumber: tokenSubject }],
  });

  if (!user) {
    throw new AppError("User not found", 404);
  }

  return user;
};

export const getConversationMessages = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const user = await getAuthenticatedUser(req.headers.authorization);
    const otherUserId = req.params.userId;

    const otherUser = await User.findById(otherUserId);

    if (!otherUser) {
      throw new AppError("Chat user not found", 404);
    }

    const messages = await Message.find({
      conversationKey: getConversationKey(
        user._id.toString(),
        otherUserId as string,
      ),
    }).sort({ createdAt: 1 });

    return res.status(200).json({
      success: true,
      message: "messages fetched successfully",
      data: messages,
    });
  } catch (error) {
    next(error);
  }
};
