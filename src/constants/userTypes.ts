export type GoogleSignInResponse = {
  user: {
    id: string;
    email: string;
    name: string;
    givenName: string;
    familyName: string;
    photo: string;
    phoneNumber?: string;
    gender?: "male" | "female" | "other";
    userType?: "admin" | "user" | "superadmin";
  };
  idToken: string;
  serverAuthCode: string | null;
};
export type CreateUserPayload = {
  firebaseUid?: string;
  googleId?: string;
  email?: string;
  name?: string;
  givenName?: string;
  familyName?: string;
  location?: string;
  photo?: string;
  phoneNumber?: string;
  gender?: "male" | "female" | "other";
  userType?: "admin" | "user" | "superadmin";
};

export type PhoneSignInResponse = {
  firebaseUid: string;
  idToken: string;
  phoneNumber: string;
};

export type LoginPayload = {
  identifier: string;
  password: string;
};
