import { InferSchemaType, Schema, model } from "mongoose";

export const USER_TYPES = ["admin", "user", "superadmin"] as const;
export const GENDERS = ["male", "female", "other"] as const;

const userSchema = new Schema(
  {
    googleId: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },
    firebaseUid: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },
    email: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
    },
    name: {
      type: String,
      default: "",
      trim: true,
    },
    givenName: {
      type: String,
      default: "",
      trim: true,
    },
    familyName: {
      type: String,
      default: "",
      trim: true,
    },
    photo: {
      type: String,
      default: "",
      trim: true,
    },
    location: {
      type: String,
      default: "",
      trim: true,
    },
    phoneNumber: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      set: (value?: string) => {
        const trimmedValue = value?.trim();

        return trimmedValue || undefined;
      },
    },
    password: {
      type: String,
      select: false,
    },
    gender: {
      type: String,
      enum: GENDERS,
    },
    userType: {
      type: String,
      enum: USER_TYPES,
      default: "user",
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

export type User = InferSchemaType<typeof userSchema>;

const UserModel = model<User>("User", userSchema);

export default UserModel;
