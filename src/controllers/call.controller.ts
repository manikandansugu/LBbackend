import { NextFunction, Request, Response } from "express";
import Call from "../models/call.model";
import User from "../models/user.model";
import { AppError } from "../utils/AppError";
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

export const getCallHistory = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const user = await getAuthenticatedUser(req.headers.authorization);
    const userId = user._id.toString();

    const calls = await Call.find({
      $or: [{ initiator: user._id }, { receiver: user._id }],
    })
      .populate("initiator", "name givenName email phoneNumber photo")
      .populate("receiver", "name givenName email phoneNumber photo")
      .sort({ startedAt: -1 })
      .limit(100);

    const history = calls.map(call => {
      const initiator = call.initiator as unknown as {
        _id: { toString: () => string };
        email?: string;
        givenName?: string;
        name?: string;
        phoneNumber?: string;
        photo?: string;
      };
      const receiver = call.receiver as unknown as typeof initiator;
      const isOutgoing = initiator._id.toString() === userId;
      const contact = isOutgoing ? receiver : initiator;

      return {
        answeredAt: call.answeredAt,
        callId: call.callId,
        callLogId: call.callLogId || call._id.toString(),
        contact: {
          imageUrl: contact.photo,
          name:
            contact.name ||
            contact.givenName ||
            contact.email ||
            contact.phoneNumber ||
            "Lee&Bee",
          userId: contact._id.toString(),
        },
        direction:
          call.status === "missed" && !isOutgoing
            ? "missed"
            : isOutgoing
              ? "outgoing"
              : "incoming",
        durationSeconds: call.durationSeconds,
        endedAt: call.endedAt,
        initiatorUserId: initiator._id.toString(),
        mediaType: call.mediaType,
        receiverUserId: receiver._id.toString(),
        startedAt: call.startedAt,
        status: call.status,
      };
    });

    return res.status(200).json({
      success: true,
      message: "call history fetched successfully",
      data: history,
    });
  } catch (error) {
    next(error);
  }
};
