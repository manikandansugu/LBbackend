import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
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

export const getStreamToken = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const user = await getAuthenticatedUser(req.headers.authorization);
    const apiKey = process.env.STREAM_API_KEY;
    const apiSecret = process.env.STREAM_API_SECRET || process.env.STREAM_SECRET;

    if (!apiKey || !apiSecret) {
      throw new AppError("Stream credentials are not configured", 500);
    }

    const userId = user._id.toString();
    const token = jwt.sign({ user_id: userId }, apiSecret, {
      algorithm: "HS256",
      expiresIn: "12h",
    });

    return res.status(200).json({
      success: true,
      message: "stream token fetched successfully",
      data: {
        apiKey,
        token,
        user: {
          id: userId,
          image: user.photo,
          name: user.name || user.givenName || user.email || user.phoneNumber,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};
