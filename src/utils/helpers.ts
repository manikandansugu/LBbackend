import { randomBytes, scryptSync } from "crypto";
import jwt from "jsonwebtoken";

export const generate_token = (payload: string) => {
  const secret = process.env.SECRET as string;
  return jwt.sign(payload, secret);
};

export const verify_token = (token: string) => {
  const secret = process.env.SECRET as string;
  const decoded = jwt.verify(token, secret);

  return typeof decoded === "string" ? decoded : "";
};

export const hash_password = (password: string) => {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");

  return `${salt}:${hash}`;
};

export const compare_password = (password: string, storedPassword: string) => {
  const [salt, hash] = storedPassword.split(":");

  if (!salt || !hash) {
    return false;
  }

  return scryptSync(password, salt, 64).toString("hex") === hash;
};
