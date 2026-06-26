import { NextFunction, Request, Response } from "express";
import User from "../models/user.model";
import {
  CreateUserPayload,
  GoogleSignInResponse,
  LoginPayload,
  PhoneSignInResponse,
} from "../constants/userTypes";
import { AppError } from "../utils/AppError";
import {
  compare_password,
  generate_token,
  hash_password,
  verify_token,
} from "../utils/helpers";

const getUserTokenSubject = (user: {
  email?: string | null;
  phoneNumber?: string | null;
}) => user.email || user.phoneNumber || "";

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

export const signUpWithEmail = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const {
    user: details,
    idToken,
    serverAuthCode,
  } = req.body as unknown as GoogleSignInResponse;
  try {
    const isUserExist = await User.findOne({ email: details?.email });
    if (isUserExist?.email) {
      return res.status(200).json({
        success: true,
        message: "login successfully",
        data: isUserExist,
        token: generate_token(getUserTokenSubject(isUserExist)),
      });
    } else {
      const normalizedPhoneNumber = details?.phoneNumber?.trim();
      const payload: CreateUserPayload = {
        googleId: details?.id,
        email: details?.email,
        name: details?.familyName,
        familyName: details?.familyName,
        givenName: details?.givenName,
        photo: details?.photo,
        gender: details?.gender ?? "male",
        ...(normalizedPhoneNumber && { phoneNumber: normalizedPhoneNumber }),
        userType: details?.userType ?? "user",
      };
      const user = await User.create(payload);
      await user.save();
      if (user) {
        return res.status(201).json({
          success: true,
          message: "user create successfully",
          data: user,
          token: generate_token(getUserTokenSubject(user)),
        });
      }
    }
  } catch (error) {
    next(error);
  }
};

export const getUsers = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const token = getBearerToken(req.headers.authorization);
    let tokenSubject = "";

    if (token) {
      try {
        tokenSubject = verify_token(token);
      } catch {
        tokenSubject = "";
      }
    }

    const users = await User.find(
      tokenSubject
        ? {
            $nor: [{ email: tokenSubject }, { phoneNumber: tokenSubject }],
          }
        : {},
    ).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      message: "users fetched successfully",
      data: users,
    });
  } catch (error) {
    next(error);
  }
};

export const getProfile = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const user = await getAuthenticatedUser(req.headers.authorization);

    return res.status(200).json({
      success: true,
      message: "profile fetched successfully",
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

export const updateProfile = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const user = await getAuthenticatedUser(req.headers.authorization);
    const {
      familyName,
      gender,
      givenName,
      location,
      name,
      photo,
    } = req.body as {
      familyName?: string;
      gender?: string;
      givenName?: string;
      location?: string;
      name?: string;
      photo?: string;
    };

    const trimmedName = name?.trim();
    const trimmedGivenName = givenName?.trim();
    const trimmedFamilyName = familyName?.trim();
    const trimmedLocation = location?.trim();
    const trimmedPhoto = photo?.trim();

    if (trimmedName !== undefined) {
      user.name = trimmedName;
    }

    if (trimmedGivenName !== undefined) {
      user.givenName = trimmedGivenName;
    }

    if (trimmedFamilyName !== undefined) {
      user.familyName = trimmedFamilyName;
    }

    if (trimmedLocation !== undefined) {
      user.location = trimmedLocation;
    }

    if (trimmedPhoto !== undefined) {
      user.photo = trimmedPhoto;
    }

    if (gender !== undefined) {
      if (!["male", "female", "other"].includes(gender)) {
        throw new AppError("Invalid gender", 400);
      }

      user.gender = gender as "male" | "female" | "other";
    }

    await user.save();

    const updatedUser = await User.findById(user._id);

    return res.status(200).json({
      success: true,
      message: "profile updated successfully",
      data: updatedUser,
      token: generate_token(getUserTokenSubject(user)),
    });
  } catch (error) {
    next(error);
  }
};

export const signUpWithPhoneNumber = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const { firebaseUid, phoneNumber } = req.body as PhoneSignInResponse;

  try {
    const normalizedPhoneNumber = phoneNumber?.trim();

    if (!normalizedPhoneNumber) {
      return res.status(400).json({
        success: false,
        message: "phone number is required",
      });
    }

    const existingUser = await User.findOne({
      $or: [
        { phoneNumber: normalizedPhoneNumber },
        ...(firebaseUid ? [{ firebaseUid }] : []),
      ],
    });

    if (existingUser) {
      return res.status(200).json({
        success: true,
        message: "login successfully",
        data: existingUser,
        token: generate_token(getUserTokenSubject(existingUser)),
      });
    }

    const payload: CreateUserPayload = {
      firebaseUid,
      phoneNumber: normalizedPhoneNumber,
      name: normalizedPhoneNumber,
      givenName: "",
      familyName: "",
      photo: "",
      gender: "male",
      userType: "user",
    };
    const user = await User.create(payload);
    await user.save();

    return res.status(201).json({
      success: true,
      message: "user create successfully",
      data: user,
      token: generate_token(getUserTokenSubject(user)),
    });
  } catch (error) {
    next(error);
  }
};

export const createPassword = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const token = getBearerToken(req.headers.authorization);

    if (!token) {
      throw new AppError("Authorization token is required", 401);
    }

    const tokenSubject = verify_token(token);

    if (!tokenSubject) {
      throw new AppError("Invalid authorization token", 401);
    }

    const { location, password } = req.body as {
      location?: string;
      password?: string;
    };
    const normalizedLocation = location?.trim();

    if (!normalizedLocation) {
      throw new AppError("Location is required", 400);
    }

    if (!password || password.length < 8) {
      throw new AppError("Password must be at least 8 characters", 400);
    }

    const user = await User.findOne({
      $or: [{ email: tokenSubject }, { phoneNumber: tokenSubject }],
    });

    if (!user) {
      throw new AppError("User not found", 404);
    }

    user.location = normalizedLocation;
    user.password = hash_password(password);
    await user.save();

    const updatedUser = await User.findById(user._id);

    return res.status(200).json({
      success: true,
      message: "password create successfully",
      data: updatedUser,
      token: generate_token(getUserTokenSubject(user)),
    });
  } catch (error) {
    next(error);
  }
};

export const login = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { identifier, password } = req.body as LoginPayload;
    const normalizedIdentifier = identifier?.trim().toLowerCase();

    if (!normalizedIdentifier || !password) {
      throw new AppError("Email or phone and password are required", 400);
    }

    const user = await User.findOne({
      $or: [
        { email: normalizedIdentifier },
        ...(identifier.trim() ? [{ phoneNumber: identifier.trim() }] : []),
      ],
    }).select("+password");

    if (!user?.password || !compare_password(password, user.password)) {
      throw new AppError("Invalid email/phone or password", 401);
    }

    const safeUser = await User.findById(user._id);

    return res.status(200).json({
      success: true,
      message: "login successfully",
      data: safeUser,
      token: generate_token(getUserTokenSubject(user)),
    });
  } catch (error) {
    next(error);
  }
};
